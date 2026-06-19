import {
  CreateHouseholdInputSchema,
  formatValidationIssues,
  type AdminHouseholdRecord,
  GenericInviteError,
  HouseholdImportRowSchema,
  InviteLifecycleUpdateSchema,
  RsvpUpdateSchema,
  UpdateHouseholdInputSchema,
  UpdateHouseholdMemberInputSchema,
  type Household,
  type RsvpUpdate,
  type StoredRsvp,
} from '@matt-alison-wedding/shared';
import { randomUUID } from 'node:crypto';
import QRCode from 'qrcode';
import { buildHouseholdsFromRows, invitationExportToCsv, parseCsv, rsvpsToCsv } from './csv.js';
import { generateInviteCode, hashInviteCode } from './inviteCodes.js';
import type { RsvpNotifier } from './notifications.js';
import type { WeddingRepository } from './repository.js';

export class PublicError extends Error {
  constructor(
    message: string,
    readonly statusCode = 400,
    readonly details?: string[],
  ) {
    super(message);
  }
}

export class WeddingService {
  constructor(
    private readonly repository: WeddingRepository,
    private readonly inviteCodePepper: string,
    private readonly rsvpNotifier?: RsvpNotifier,
  ) {}

  async getRsvp(inviteCode: string): Promise<{ household: Household; rsvp?: StoredRsvp }> {
    const household = await this.findHouseholdByInviteCode(inviteCode);
    return {
      household,
      rsvp: await this.getStoredRsvp(household.householdId),
    };
  }

  async updateRsvp(inviteCode: string, input: unknown): Promise<{ household: Household; rsvp: StoredRsvp }> {
    const household = await this.findHouseholdByInviteCode(inviteCode);
    const parsed = RsvpUpdateSchema.safeParse(input);
    if (!parsed.success) {
      throw new PublicError('RSVP validation failed', 422, formatValidationIssues(parsed.error));
    }

    this.validateRsvpAgainstHousehold(household, parsed.data);

    const now = new Date().toISOString();
    const existing = await this.getStoredRsvp(household.householdId);
    const rsvp: StoredRsvp = {
      ...parsed.data,
      submittedAt: existing?.submittedAt ?? now,
      updatedAt: now,
    };

    await this.repository.saveRsvp(household.householdId, rsvp);
    await this.notifyRsvpChanged(household, rsvp);
    return { household, rsvp };
  }

  async listHouseholds(): Promise<AdminHouseholdRecord[]> {
    const households = await this.repository.listHouseholds();
    return Promise.all(
      households.map(async (household) => {
        const rsvp = await this.getStoredRsvp(household.householdId);
        return {
          household,
          rsvp,
          attendance: summarizeAttendance(household, rsvp),
        };
      }),
    );
  }

  async createHousehold(input: unknown): Promise<Household> {
    const parsed = CreateHouseholdInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new PublicError('Household validation failed', 422, formatValidationIssues(parsed.error));
    }

    const now = new Date().toISOString();
    const householdId = randomUUID();
    const household: Household = {
      householdId,
      displayName: parsed.data.displayName,
      email: parsed.data.email || undefined,
      mailingAddress: parsed.data.mailingAddress,
      members: parsed.data.members.map((member, index) => ({
        id: `${householdId}-${index + 1}`,
        firstName: member.firstName,
        lastName: member.lastName,
        canBringPlusOne: member.canBringPlusOne,
        weddingPartyRole: member.weddingPartyRole,
        rehearsalDinnerInvited: member.rehearsalDinnerInvited,
      })),
      maxPlusOnes: parsed.data.maxPlusOnes,
      rsvpStatus: 'not_started',
      inviteLifecycleStatus: 'not_generated',
      createdAt: now,
      updatedAt: now,
    };

    await this.repository.saveHousehold(household);
    return household;
  }

  async importHouseholds(csv: string): Promise<{ imported: number; households: Household[] }> {
    const rawRows = parseCsv(csv);
    const parsedRows = rawRows.map((row, index) => {
      const parsed = HouseholdImportRowSchema.safeParse(row);
      if (!parsed.success) {
        throw new PublicError(
          `Import row ${index + 2} is invalid`,
          422,
          formatValidationIssues(parsed.error),
        );
      }
      return parsed.data;
    });

    const ids = new Set<string>();
    for (const row of parsedRows) {
      ids.add(row.householdId);
    }

    const now = new Date().toISOString();
    const households = buildHouseholdsFromRows(parsedRows, now);
    for (const household of households) {
      await this.repository.saveHousehold(household);
    }

    return { imported: ids.size, households };
  }

  async updateHousehold(householdId: string, input: unknown): Promise<Household> {
    const household = await this.requireHousehold(householdId);
    const parsed = UpdateHouseholdInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new PublicError('Household validation failed', 422, formatValidationIssues(parsed.error));
    }

    const now = new Date().toISOString();
    const updated: Household = {
      ...household,
      displayName: parsed.data.displayName,
      email: parsed.data.email || undefined,
      mailingAddress: parsed.data.mailingAddress,
      maxPlusOnes: parsed.data.maxPlusOnes,
      updatedAt: now,
    };

    await this.repository.saveHousehold(updated);
    return updated;
  }

  async updateHouseholdMember(householdId: string, memberId: string, input: unknown): Promise<Household> {
    const household = await this.requireHousehold(householdId);
    const parsed = UpdateHouseholdMemberInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new PublicError('Household member validation failed', 422, formatValidationIssues(parsed.error));
    }

    if (!household.members.some((member) => member.id === memberId)) {
      throw new PublicError('Household member not found', 404);
    }

    const now = new Date().toISOString();
    const updated: Household = {
      ...household,
      members: household.members.map((member) =>
        member.id === memberId ? { ...member, ...parsed.data } : member,
      ),
      updatedAt: now,
    };

    await this.repository.saveHousehold(updated);
    return updated;
  }

  async removeHouseholdMember(householdId: string, memberId: string): Promise<Household> {
    const household = await this.requireHousehold(householdId);
    const member = household.members.find((entry) => entry.id === memberId);
    if (!member) {
      throw new PublicError('Household member not found', 404);
    }

    const rsvp = await this.getStoredRsvp(householdId);
    const now = new Date().toISOString();

    if (rsvp?.members.some((entry) => entry.memberId === memberId)) {
      const updated = {
        ...household,
        members: household.members.map((entry) =>
          entry.id === memberId ? { ...entry, archivedAt: entry.archivedAt ?? now } : entry,
        ),
        updatedAt: now,
      };
      await this.repository.saveHousehold(updated);
      return updated;
    }

    if (household.members.filter((entry) => !entry.archivedAt).length <= 1) {
      throw new PublicError('Households must keep at least one active member', 422);
    }

    const updated = {
      ...household,
      members: household.members.filter((entry) => entry.id !== memberId),
      updatedAt: now,
    };
    await this.repository.saveHousehold(updated);
    return updated;
  }

  async archiveHousehold(householdId: string): Promise<Household> {
    const household = await this.requireHousehold(householdId);
    const now = new Date().toISOString();
    const updated: Household = {
      ...household,
      inviteLifecycleStatus: 'archived',
      archivedAt: household.archivedAt ?? now,
      updatedAt: now,
    };
    await this.repository.saveHousehold(updated);
    return updated;
  }

  async updateInviteLifecycle(householdId: string, input: unknown): Promise<Household> {
    const household = await this.requireHousehold(householdId);
    const parsed = InviteLifecycleUpdateSchema.safeParse(input);
    if (!parsed.success) {
      throw new PublicError('Invite lifecycle update is invalid', 422, formatValidationIssues(parsed.error));
    }

    if (parsed.data.status === 'not_generated') {
      throw new PublicError('Invite lifecycle cannot move back to not generated', 422);
    }
    if (parsed.data.status === 'generated' && household.inviteLifecycleStatus !== 'not_generated') {
      throw new PublicError('Invite lifecycle cannot move back to generated', 422);
    }
    if (parsed.data.status === 'sent' && household.inviteLifecycleStatus !== 'exported') {
      throw new PublicError('Invitations must be exported before they are marked sent', 422);
    }

    const now = new Date().toISOString();
    const updated: Household = {
      ...household,
      inviteLifecycleStatus: parsed.data.status,
      inviteExportedAt:
        parsed.data.status === 'exported' ? household.inviteExportedAt ?? now : household.inviteExportedAt,
      inviteSentAt: parsed.data.status === 'sent' ? household.inviteSentAt ?? now : household.inviteSentAt,
      archivedAt: parsed.data.status === 'archived' ? household.archivedAt ?? now : household.archivedAt,
      updatedAt: now,
    };
    await this.repository.saveHousehold(updated);
    return updated;
  }

  async rotateInviteCode(
    householdId: string,
    options: { confirmRotation?: boolean } = {},
  ): Promise<{ inviteCode: string; inviteCodeHash: string }> {
    const household = await this.repository.getHousehold(householdId);
    if (!household) {
      throw new PublicError('Household not found', 404);
    }
    this.validateInviteRotationAllowed(household, options.confirmRotation === true);

    const rotatedAt = new Date().toISOString();
    const inviteCode = generateInviteCode();
    const inviteCodeHash = hashInviteCode(inviteCode, this.inviteCodePepper);
    await this.repository.saveInviteCodeLookup({
      householdId,
      inviteCodeHash,
      createdAt: rotatedAt,
    });
    await this.repository.saveHousehold({
      ...household,
      inviteLifecycleStatus: 'generated',
      inviteCodeHash,
      inviteCodeGeneratedAt: household.inviteCodeGeneratedAt ?? rotatedAt,
      inviteCodeLastRotatedAt: rotatedAt,
      updatedAt: rotatedAt,
    });

    return { inviteCode, inviteCodeHash };
  }

  async exportRsvps(): Promise<string> {
    const households = await this.repository.listHouseholds();
    const rows = await Promise.all(
      households.map(async (household) => ({
        household,
        rsvp: await this.getStoredRsvp(household.householdId),
      })),
    );

    return rsvpsToCsv(rows);
  }

  async exportInvitations(baseUrl: string): Promise<string> {
    const households = (await this.repository.listHouseholds()).filter((household) => !household.archivedAt);
    const rows = [];
    const now = new Date().toISOString();

    for (const household of households) {
      if (household.inviteLifecycleStatus === 'sent') {
        rows.push({
          household,
          rsvpUrl: '',
          qrCodeDataUrl: '',
        });
        continue;
      }

      const inviteCode = generateInviteCode();
      const inviteCodeHash = hashInviteCode(inviteCode, this.inviteCodePepper);
      await this.repository.saveInviteCodeLookup({
        householdId: household.householdId,
        inviteCodeHash,
        createdAt: now,
      });

      const updated: Household = {
        ...household,
        inviteLifecycleStatus: 'exported',
        inviteCodeHash,
        inviteCodeGeneratedAt: household.inviteCodeGeneratedAt ?? now,
        inviteExportedAt: household.inviteExportedAt ?? now,
        inviteCodeLastRotatedAt: now,
        updatedAt: now,
      };
      await this.repository.saveHousehold(updated);

      const rsvpUrl = `${baseUrl.replace(/\/$/, '')}/rsvp/${encodeURIComponent(inviteCode)}`;
      rows.push({
        household: updated,
        rsvpUrl,
        qrCodeDataUrl: await QRCode.toDataURL(rsvpUrl, { margin: 1, width: 256 }),
      });
    }

    return invitationExportToCsv(rows);
  }

  private async findHouseholdByInviteCode(inviteCode: string): Promise<Household> {
    const hash = hashInviteCode(inviteCode, this.inviteCodePepper);
    const household = await this.repository.getHouseholdByInviteHash(hash);
    if (!household || household.archivedAt || household.inviteLifecycleStatus === 'archived') {
      throw new PublicError(GenericInviteError, 404);
    }
    if (household.inviteCodeHash !== hash) {
      throw new PublicError(GenericInviteError, 404);
    }
    return household;
  }

  private async requireHousehold(householdId: string): Promise<Household> {
    const household = await this.repository.getHousehold(householdId);
    if (!household) {
      throw new PublicError('Household not found', 404);
    }
    return household;
  }

  private async getStoredRsvp(householdId: string): Promise<StoredRsvp | undefined> {
    return this.repository.getRsvp(householdId);
  }

  private validateRsvpAgainstHousehold(household: Household, rsvp: RsvpUpdate): void {
    const activeMembers = household.members.filter((member) => !member.archivedAt);
    const allowedMemberIds = new Set(activeMembers.map((member) => member.id));
    const submittedMemberIds = new Set(rsvp.members.map((member) => member.memberId));
    const attendingMemberIds = new Set(
      rsvp.members.filter((member) => member.attending).map((member) => member.memberId),
    );

    if (allowedMemberIds.size !== submittedMemberIds.size) {
      throw new PublicError('RSVP must include every household member', 422);
    }

    for (const memberId of submittedMemberIds) {
      if (!allowedMemberIds.has(memberId)) {
        throw new PublicError('RSVP includes an unknown household member', 422);
      }
    }

    const plusOneAllowedMemberIds = new Set(
      activeMembers.filter((member) => member.canBringPlusOne).map((member) => member.id),
    );
    if (rsvp.plusOnes.length > household.maxPlusOnes) {
      throw new PublicError('RSVP includes too many plus-ones', 422);
    }

    for (const plusOne of rsvp.plusOnes) {
      if (!plusOneAllowedMemberIds.has(plusOne.sponsorMemberId)) {
        throw new PublicError('This household is not allowed to add that plus-one', 422);
      }
      if (!attendingMemberIds.has(plusOne.sponsorMemberId)) {
        throw new PublicError('A plus-one sponsor must be attending', 422);
      }
    }
  }

  private validateInviteRotationAllowed(household: Household, confirmed: boolean): void {
    if (household.inviteLifecycleStatus === 'sent') {
      throw new PublicError('Sent invitations cannot be rotated. Archive the household or contact guests directly.', 409);
    }
    if (household.inviteLifecycleStatus === 'archived') {
      throw new PublicError('Archived household invite codes cannot be rotated', 409);
    }
    if (household.inviteLifecycleStatus === 'exported' && !confirmed) {
      throw new PublicError('Rotating an exported invite requires explicit confirmation', 409);
    }
  }

  private async notifyRsvpChanged(household: Household, rsvp: StoredRsvp): Promise<void> {
    if (!this.rsvpNotifier) {
      return;
    }

    try {
      await this.rsvpNotifier.notifyRsvpChanged({ household, rsvp });
    } catch (error) {
      console.error('RSVP notification failed', {
        householdId: household.householdId,
        rsvpUpdatedAt: rsvp.updatedAt,
        error,
      });
    }
  }
}

function summarizeAttendance(
  household: Household,
  rsvp?: StoredRsvp,
): AdminHouseholdRecord['attendance'] {
  if (!rsvp) {
    return {
      invitedGuests: household.members.filter((member) => !member.archivedAt).length + household.maxPlusOnes,
      attendingGuests: 0,
      declinedGuests: 0,
      pendingGuests: household.members.filter((member) => !member.archivedAt).length,
      plusOneGuests: 0,
    };
  }

  const attendingGuests = rsvp.members.filter((member) => member.attending).length + rsvp.plusOnes.length;
  const declinedGuests = rsvp.members.filter((member) => !member.attending).length;

  return {
    invitedGuests: household.members.length + household.maxPlusOnes,
    attendingGuests,
    declinedGuests,
    pendingGuests: 0,
    plusOneGuests: rsvp.plusOnes.length,
  };
}
