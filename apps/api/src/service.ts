import {
  CreateHouseholdInputSchema,
  formatValidationIssues,
  type AdminHouseholdRecord,
  type BulkInvitationEmailResponse,
  GenericRecoverySuccessMessage,
  GenericInviteError,
  HouseholdImportRowSchema,
  InviteLifecycleUpdateSchema,
  type InvitationDetails,
  type InvitationEmailResult,
  type RsvpRecoveryAcceptedResponse,
  RsvpRecoveryRequestSchema,
  RsvpUpdateSchema,
  type SendInvitationEmailResponse,
  SendHouseholdNotificationInputSchema,
  type SendHouseholdNotificationResponse,
  UpdateHouseholdInputSchema,
  UpdateHouseholdMemberInputSchema,
  type Household,
  type HouseholdImportRow,
  type RsvpUpdate,
  type StoredRsvp,
} from '@matt-alison-wedding/shared';
import { createHash, randomUUID } from 'node:crypto';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { buildHouseholdsFromRows, invitationExportToCsv, parseCsv, rsvpsToCsv } from './csv.js';
import { generateInviteCode, hashInviteCode } from './inviteCodes.js';
import type { InviteCodeProtector } from './inviteCodeProtector.js';
import type { HouseholdMessenger, RsvpNotifier } from './notifications.js';
import { deriveRsvpStatus, type WeddingRepository } from './repository.js';

const RSVP_RECOVERY_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RSVP_RECOVERY_CONTACT_LIMIT = 3;
const RSVP_RECOVERY_IP_LIMIT = 10;
const POINTS_PER_INCH = 72;
const AVERY_5160_LABEL = {
  pageWidth: 8.5 * POINTS_PER_INCH,
  pageHeight: 11 * POINTS_PER_INCH,
  columns: 3,
  rows: 10,
  labelWidth: 2.625 * POINTS_PER_INCH,
  labelHeight: 1 * POINTS_PER_INCH,
  marginLeft: 0.1875 * POINTS_PER_INCH,
  marginTop: 0.5 * POINTS_PER_INCH,
  horizontalPitch: 2.75 * POINTS_PER_INCH,
  verticalPitch: 1 * POINTS_PER_INCH,
};

interface PreparedInvitationExportRow {
  household: Household;
  rsvpUrl: string;
}

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
    private readonly householdMessenger?: HouseholdMessenger,
    private readonly inviteCodeProtector?: InviteCodeProtector,
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
    const updatedHousehold: Household = {
      ...household,
      rsvpStatus: deriveRsvpStatus(rsvp),
      updatedAt: now,
    };

    await this.repository.saveRsvp(household.householdId, rsvp);
    await this.notifyRsvpChanged(updatedHousehold, rsvp);
    return { household: updatedHousehold, rsvp };
  }

  async requestRsvpRecovery(
    input: unknown,
    requestContext: { sourceIp?: string; baseUrl: string },
  ): Promise<RsvpRecoveryAcceptedResponse> {
    const parsed = RsvpRecoveryRequestSchema.safeParse(input);
    if (!parsed.success) {
      throw new PublicError('Recovery contact is invalid', 422, [
        'contact: Enter a valid email address or mobile number.',
      ]);
    }

    const contact = normalizeRecoveryContact(parsed.data.contact);
    const contactHash = stableHash(`recovery-contact:${contact.kind}:${contact.value}`, this.inviteCodePepper);
    const sourceIpHash = stableHash(
      `recovery-ip:${requestContext.sourceIp?.trim() || 'unknown'}`,
      this.inviteCodePepper,
    );
    const rateLimited = await this.isRsvpRecoveryRateLimited(contactHash, sourceIpHash);
    if (rateLimited) {
      return acceptedRecoveryResponse();
    }

    const households =
      contact.kind === 'email'
        ? await this.repository.listHouseholdsByEmail(contact.value)
        : await this.repository.listHouseholdsByPhone(contact.value);

    if (!this.householdMessenger || households.length === 0) {
      return acceptedRecoveryResponse();
    }

    for (const household of households) {
      if (household.archivedAt || household.inviteLifecycleStatus === 'archived') {
        continue;
      }

      try {
        const inviteCode = await this.getRecoverableInviteCode(household);
        if (!inviteCode) {
          continue;
        }

        const invitation = this.buildInvitationDetails(household, inviteCode, requestContext.baseUrl);
        if (contact.kind === 'email') {
          await this.householdMessenger.sendRecoveryEmail({ household, invitation });
        } else {
          await this.householdMessenger.sendRecoverySms({ household, invitation });
        }
      } catch (error) {
        console.error('RSVP recovery delivery failed', {
          householdId: household.householdId,
          contactKind: contact.kind,
          error,
        });
      }
    }

    return acceptedRecoveryResponse();
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
          hasRecoverableInviteCode: Boolean(
            await this.repository.getInviteCodeSecret(household.householdId),
          ),
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
      email: normalizeOptionalEmail(parsed.data.email),
      phone: normalizeOptionalPhoneNumber(parsed.data.phone),
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
    const normalizedRows = parsedRows.map((row, index) =>
      normalizeImportedHouseholdRow(row, index + 2),
    );

    const households = buildHouseholdsFromRows(normalizedRows, now);
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
      email: normalizeOptionalEmail(parsed.data.email),
      phone: normalizeOptionalPhoneNumber(parsed.data.phone),
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
    if (household.archivedAt || household.inviteLifecycleStatus === 'archived') {
      throw new PublicError('Household is already archived', 409);
    }
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
    await this.saveInviteCodeArtifacts(householdId, inviteCode, inviteCodeHash, rotatedAt);
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

  async revealInvitation(householdId: string, baseUrl: string): Promise<InvitationDetails> {
    const household = await this.requireHousehold(householdId);
    if (household.archivedAt || household.inviteLifecycleStatus === 'archived') {
      throw new PublicError('Archived household invitations cannot be revealed', 409);
    }

    const inviteCode = await this.getRecoverableInviteCode(household);
    if (!inviteCode || !household.inviteCodeHash) {
      throw new PublicError('This invitation does not have a recoverable invite code', 404);
    }

    return this.buildInvitationDetails(household, inviteCode, baseUrl);
  }

  async sendInvitationEmail(
    householdId: string,
    baseUrl: string,
  ): Promise<SendInvitationEmailResponse> {
    const household = await this.requireHousehold(householdId);
    if (household.archivedAt || household.inviteLifecycleStatus === 'archived') {
      return {
        result: invitationEmailResult(household, 'skipped', 'Archived households cannot receive invitation emails'),
      };
    }
    if (!household.email) {
      return {
        result: invitationEmailResult(household, 'skipped', 'Household does not have a contact email address'),
      };
    }
    if (!this.householdMessenger) {
      throw new PublicError('Outbound household notifications are not available', 503);
    }

    const invitation = await this.ensureRecoverableInvitation(household, baseUrl);
    try {
      const result = await this.householdMessenger.sendInvitationEmail({
        household,
        invitation,
      });
      await this.markInvitationSent(household);
      return { result, invitation };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to send invitation email';
      return {
        invitation,
        result: invitationEmailResult(household, 'failed', message),
      };
    }
  }

  async sendInvitationEmails(baseUrl: string): Promise<BulkInvitationEmailResponse> {
    const households = (await this.repository.listHouseholds()).filter(
      (household) => !household.archivedAt && household.inviteLifecycleStatus !== 'archived',
    );
    const results: InvitationEmailResult[] = [];

    for (const household of households) {
      try {
        const response = await this.sendInvitationEmail(household.householdId, baseUrl);
        results.push(response.result);
      } catch (error) {
        results.push(
          invitationEmailResult(
            household,
            'failed',
            error instanceof Error ? error.message : 'Unable to send invitation email',
          ),
        );
      }
    }

    return { results };
  }

  async sendHouseholdNotification(
    householdId: string,
    input: unknown,
  ): Promise<SendHouseholdNotificationResponse> {
    const household = await this.requireHousehold(householdId);
    if (household.archivedAt || household.inviteLifecycleStatus === 'archived') {
      throw new PublicError('Archived households cannot receive guest notifications', 409);
    }

    const parsed = SendHouseholdNotificationInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new PublicError(
        'Household notification is invalid',
        422,
        formatValidationIssues(parsed.error),
      );
    }

    if (!this.householdMessenger) {
      throw new PublicError('Outbound household notifications are not available', 503);
    }

    const payload = parsed.data;
    if (payload.channel === 'email' && !household.email) {
      throw new PublicError('This household does not have a contact email address', 422);
    }
    if (payload.channel === 'sms' && !household.phone) {
      throw new PublicError('This household does not have a mobile number for SMS', 422);
    }

    try {
      return await this.householdMessenger.sendHouseholdNotification({
        household,
        ...payload,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to send household notification';
      throw new PublicError(message, 502);
    }
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
    const rows = await this.prepareInvitationExportRows(baseUrl);
    const csvRows = await Promise.all(
      rows.map(async ({ household, rsvpUrl }) => ({
        household,
        rsvpUrl,
        qrCodeDataUrl: rsvpUrl ? await QRCode.toDataURL(rsvpUrl, { margin: 1, width: 256 }) : '',
      })),
    );

    return invitationExportToCsv(csvRows);
  }

  async exportInvitationLabels(baseUrl: string): Promise<Buffer> {
    const rows = await this.prepareInvitationExportRows(baseUrl);
    return createInvitationLabelsPdf(rows.filter((row) => row.rsvpUrl));
  }

  private async ensureRecoverableInvitation(
    household: Household,
    baseUrl: string,
  ): Promise<InvitationDetails> {
    const existingInviteCode = await this.getRecoverableInviteCode(household);
    if (existingInviteCode && household.inviteCodeHash) {
      return this.buildInvitationDetails(household, existingInviteCode, baseUrl);
    }

    if (household.inviteCodeHash) {
      throw new PublicError('This invitation code exists but is not recoverable. Rotate it before emailing.', 409);
    }

    const now = new Date().toISOString();
    const inviteCode = generateInviteCode();
    const inviteCodeHash = hashInviteCode(inviteCode, this.inviteCodePepper);
    await this.saveInviteCodeArtifacts(household.householdId, inviteCode, inviteCodeHash, now);
    const updated: Household = {
      ...household,
      inviteLifecycleStatus: 'generated',
      inviteCodeHash,
      inviteCodeGeneratedAt: household.inviteCodeGeneratedAt ?? now,
      inviteCodeLastRotatedAt: now,
      updatedAt: now,
    };
    await this.repository.saveHousehold(updated);
    return this.buildInvitationDetails(updated, inviteCode, baseUrl);
  }

  private async saveInviteCodeArtifacts(
    householdId: string,
    inviteCode: string,
    inviteCodeHash: string,
    timestamp: string,
  ): Promise<void> {
    if (!this.inviteCodeProtector) {
      throw new PublicError('Recoverable invite-code storage is not configured', 503);
    }

    await this.repository.saveInviteCodeLookup({
      householdId,
      inviteCodeHash,
      createdAt: timestamp,
    });
    await this.repository.saveInviteCodeSecret({
      householdId,
      inviteCodeHash,
      inviteCodeCiphertext: await this.inviteCodeProtector.encryptInviteCode(inviteCode),
      updatedAt: timestamp,
    });
  }

  private async getRecoverableInviteCode(household: Household): Promise<string | undefined> {
    if (!household.inviteCodeHash || !this.inviteCodeProtector) {
      return undefined;
    }

    const secret = await this.repository.getInviteCodeSecret(household.householdId);
    if (!secret || secret.inviteCodeHash !== household.inviteCodeHash) {
      return undefined;
    }

    const inviteCode = await this.inviteCodeProtector.decryptInviteCode(secret.inviteCodeCiphertext);
    if (hashInviteCode(inviteCode, this.inviteCodePepper) !== household.inviteCodeHash) {
      throw new PublicError('Stored invite code does not match the current household invite hash', 409);
    }

    return inviteCode;
  }

  private async prepareInvitationExportRows(baseUrl: string): Promise<PreparedInvitationExportRow[]> {
    const households = (await this.repository.listHouseholds()).filter(
      (household) => !household.archivedAt && household.inviteLifecycleStatus !== 'archived',
    );
    const rows: PreparedInvitationExportRow[] = [];
    const now = new Date().toISOString();

    for (const household of households) {
      const inviteCode =
        (await this.getRecoverableInviteCode(household)) ??
        (!household.inviteCodeHash ? generateInviteCode() : undefined);

      if (!inviteCode) {
        rows.push({
          household,
          rsvpUrl: '',
        });
        continue;
      }

      const inviteCodeHash = hashInviteCode(inviteCode, this.inviteCodePepper);
      if (!household.inviteCodeHash) {
        await this.saveInviteCodeArtifacts(household.householdId, inviteCode, inviteCodeHash, now);
      }

      const updated: Household =
        household.inviteLifecycleStatus === 'sent'
          ? household
          : {
              ...household,
              inviteLifecycleStatus: 'exported',
              inviteCodeHash,
              inviteCodeGeneratedAt: household.inviteCodeGeneratedAt ?? now,
              inviteExportedAt: household.inviteExportedAt ?? now,
              inviteCodeLastRotatedAt: household.inviteCodeLastRotatedAt ?? now,
              updatedAt: now,
            };
      if (updated !== household) {
        await this.repository.saveHousehold(updated);
      }

      rows.push({
        household: updated,
        rsvpUrl: `${baseUrl.replace(/\/$/, '')}/rsvp/${encodeURIComponent(inviteCode)}`,
      });
    }

    return rows;
  }

  private buildInvitationDetails(
    household: Household,
    inviteCode: string,
    baseUrl: string,
  ): InvitationDetails {
    return {
      householdId: household.householdId,
      inviteCode,
      inviteCodeHash: household.inviteCodeHash ?? hashInviteCode(inviteCode, this.inviteCodePepper),
      rsvpUrl: `${baseUrl.replace(/\/$/, '')}/rsvp/${encodeURIComponent(inviteCode)}`,
    };
  }

  private async markInvitationSent(household: Household): Promise<void> {
    const now = new Date().toISOString();
    await this.repository.saveHousehold({
      ...household,
      inviteLifecycleStatus: 'sent',
      inviteSentAt: household.inviteSentAt ?? now,
      updatedAt: now,
    });
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

  private async isRsvpRecoveryRateLimited(
    contactHash: string,
    sourceIpHash: string,
  ): Promise<boolean> {
    const now = Date.now();
    const contactAttempts = await this.recordRsvpRecoveryAttempt('contact', contactHash, now);
    const ipAttempts = await this.recordRsvpRecoveryAttempt('ip', sourceIpHash, now);
    return contactAttempts > RSVP_RECOVERY_CONTACT_LIMIT || ipAttempts > RSVP_RECOVERY_IP_LIMIT;
  }

  private async recordRsvpRecoveryAttempt(
    scope: 'contact' | 'ip',
    keyHash: string,
    now: number,
  ): Promise<number> {
    const existing = await this.repository.getRecoveryRateLimitRecord(scope, keyHash);
    const withinWindow = existing && existing.windowExpiresAt > now;
    const attempts = withinWindow ? existing.attempts + 1 : 1;

    await this.repository.saveRecoveryRateLimitRecord({
      scope,
      keyHash,
      attempts,
      windowExpiresAt: now + RSVP_RECOVERY_RATE_LIMIT_WINDOW_MS,
      updatedAt: new Date(now).toISOString(),
    });

    return attempts;
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

function createInvitationLabelsPdf(rows: PreparedInvitationExportRow[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      autoFirstPage: false,
      bufferPages: false,
      compress: false,
      info: {
        Title: 'Invitation QR Labels',
        Subject: 'Print-ready wedding invitation RSVP QR labels',
        Creator: 'Matt and Alison Wedding Admin',
      },
      margin: 0,
      size: [AVERY_5160_LABEL.pageWidth, AVERY_5160_LABEL.pageHeight],
    });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const labelsPerPage = AVERY_5160_LABEL.columns * AVERY_5160_LABEL.rows;
    rows.forEach((row, index) => {
      if (index % labelsPerPage === 0) {
        doc.addPage({ margin: 0, size: [AVERY_5160_LABEL.pageWidth, AVERY_5160_LABEL.pageHeight] });
      }

      drawInvitationLabel(doc, row, index % labelsPerPage);
    });

    if (rows.length === 0) {
      doc.addPage({ margin: 0, size: [AVERY_5160_LABEL.pageWidth, AVERY_5160_LABEL.pageHeight] });
    }

    doc.end();
  });
}

function drawInvitationLabel(
  doc: PDFKit.PDFDocument,
  row: PreparedInvitationExportRow,
  pageLabelIndex: number,
): void {
  const column = pageLabelIndex % AVERY_5160_LABEL.columns;
  const labelRow = Math.floor(pageLabelIndex / AVERY_5160_LABEL.columns);
  const x = AVERY_5160_LABEL.marginLeft + column * AVERY_5160_LABEL.horizontalPitch;
  const y = AVERY_5160_LABEL.marginTop + labelRow * AVERY_5160_LABEL.verticalPitch;
  const qrSize = 54;
  const qrX = x + 8;
  const qrY = y + 9;
  const textX = qrX + qrSize + 8;
  const textWidth = AVERY_5160_LABEL.labelWidth - (textX - x) - 8;

  drawQrCode(doc, row.rsvpUrl, qrX, qrY, qrSize);
  doc
    .fillColor('#243238')
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .text(row.household.displayName, textX, y + 15, {
      ellipsis: true,
      height: 24,
      lineGap: 1,
      width: textWidth,
    });
  doc
    .fillColor('#52625f')
    .font('Helvetica')
    .fontSize(7)
    .text('RSVP', textX, y + 43, {
      characterSpacing: 0.5,
      width: textWidth,
    });
}

function drawQrCode(
  doc: PDFKit.PDFDocument,
  value: string,
  x: number,
  y: number,
  size: number,
): void {
  const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
  const quietModules = 2;
  const totalModules = qr.modules.size + quietModules * 2;
  const moduleSize = size / totalModules;

  doc.save();
  doc.rect(x, y, size, size).fill('#ffffff');
  doc.fillColor('#000000');
  for (let row = 0; row < qr.modules.size; row += 1) {
    for (let column = 0; column < qr.modules.size; column += 1) {
      if (qr.modules.get(row, column)) {
        doc.rect(
          x + (column + quietModules) * moduleSize,
          y + (row + quietModules) * moduleSize,
          moduleSize,
          moduleSize,
        );
      }
    }
  }
  doc.fill();
  doc.restore();
}

function normalizeImportedHouseholdRow(row: HouseholdImportRow, rowNumber: number): HouseholdImportRow {
  try {
    return {
      ...row,
      email: normalizeOptionalEmail(row.email) ?? '',
      phone: normalizeOptionalPhoneNumber(row.phone) ?? '',
    };
  } catch (error) {
    if (error instanceof PublicError) {
      throw new PublicError(`Import row ${rowNumber} is invalid`, 422, [
        `phone: ${error.message}`,
      ]);
    }

    throw error;
  }
}

function normalizeOptionalEmail(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toLowerCase() : undefined;
}

function normalizeOptionalPhoneNumber(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  const digits = trimmed.replace(/\D/g, '');
  const normalized = trimmed.startsWith('+')
    ? `+${digits}`
    : digits.length === 10
      ? `+1${digits}`
      : digits.length === 11 && digits.startsWith('1')
        ? `+${digits}`
        : undefined;

  if (!normalized || !/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw new PublicError(
      'Phone number must be a valid E.164 value or a 10-digit US mobile number',
      422,
    );
  }

  return normalized;
}

type RecoveryContact = { kind: 'email'; value: string } | { kind: 'phone'; value: string };

function normalizeRecoveryContact(value: string): RecoveryContact {
  const email = normalizeOptionalEmail(value);
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { kind: 'email', value: email };
  }

  try {
    const phone = normalizeOptionalPhoneNumber(value);
    if (phone) {
      return { kind: 'phone', value: phone };
    }
  } catch {
    // Fall through to the generic validation error below.
  }

  throw new PublicError('Recovery contact is invalid', 422, [
    'contact: Enter a valid email address or mobile number.',
  ]);
}

function stableHash(value: string, pepper: string): string {
  return createHash('sha256').update(`${pepper}:${value}`).digest('hex');
}

function acceptedRecoveryResponse(): RsvpRecoveryAcceptedResponse {
  return {
    accepted: true,
    message: GenericRecoverySuccessMessage,
  };
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

function invitationEmailResult(
  household: Household,
  status: InvitationEmailResult['status'],
  message: string,
): InvitationEmailResult {
  return {
    householdId: household.householdId,
    displayName: household.displayName,
    status,
    deliveredTo: status === 'sent' ? household.email : undefined,
    message,
  };
}
