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
  SMS_CONSENT_TEXT_VERSION,
  SmsPreferencesRequestSchema,
  type SmsConsent,
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
import QRCode from 'qrcode';
import {
  buildHouseholdsFromRows,
  invitationExportToCsv,
  parseCsv,
  rsvpsToCsv,
} from './csv.js';
import {
  generateInviteCode,
  getInviteCodeHashes,
  hashInviteCode,
  inviteCodeMatchesHash,
} from './inviteCodes.js';
import type { InviteCodeProtector } from './inviteCodeProtector.js';
import type { HouseholdMessenger, RsvpNotifier } from './notifications.js';
import { deriveRsvpStatus, type WeddingRepository } from './repository.js';
import { describeError, getErrorStatusCode, logStructured } from './logger.js';

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
  inviteCode?: string;
  rsvpUrl: string;
  websiteUrl: string;
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

  async getRsvp(
    inviteCode: string,
  ): Promise<{ household: Household; rsvp?: StoredRsvp }> {
    const household = await this.findHouseholdByInviteCode(inviteCode);
    const result = {
      household,
      rsvp: await this.getStoredRsvp(household.householdId),
    };
    logStructured({
      level: 'info',
      event: 'rsvp.lookup.completed',
      message: 'RSVP lookup completed',
      householdId: household.householdId,
      outcome: 'success',
    });
    return result;
  }

  async updateRsvp(
    inviteCode: string,
    input: unknown,
  ): Promise<{ household: Household; rsvp: StoredRsvp }> {
    const household = await this.findHouseholdByInviteCode(inviteCode);
    const parsed = RsvpUpdateSchema.safeParse(input);
    if (!parsed.success) {
      throw new PublicError(
        'RSVP validation failed',
        422,
        formatValidationIssues(parsed.error),
      );
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

    await this.repository.saveRsvpUpdate(updatedHousehold, rsvp);
    await this.notifyRsvpChanged(updatedHousehold, rsvp);
    const counts = summarizeRsvpCounts(rsvp);
    logStructured({
      level: 'info',
      event: 'rsvp.update.completed',
      message: 'RSVP update saved',
      householdId: household.householdId,
      outcome: 'success',
      rsvpStatus: updatedHousehold.rsvpStatus,
      attendingCount: counts.attendingCount,
      declinedCount: counts.declinedCount,
      plusOneCount: counts.plusOneCount,
    });
    return { household: updatedHousehold, rsvp };
  }

  async updateSmsPreferences(inviteCode: string, input: unknown): Promise<Household> {
    const household = await this.findHouseholdByInviteCode(inviteCode);
    const parsed = SmsPreferencesRequestSchema.safeParse(input);
    if (!parsed.success) {
      throw new PublicError(
        'SMS preferences are invalid',
        422,
        formatValidationIssues(parsed.error),
      );
    }

    const now = new Date().toISOString();
    if (!parsed.data.enabled) {
      const phone = household.phone ?? household.smsConsent?.phone;
      if (!phone) {
        return household;
      }
      const optedOut: Household = {
        ...household,
        smsConsent: createSmsConsent(phone, 'sms_preferences', now, 'opted_out'),
        updatedAt: now,
      };
      await this.repository.saveHousehold(optedOut);
      return optedOut;
    }

    const phone = normalizeRequiredPhoneNumber(
      parsed.data.phone,
      'Enter a mobile number to receive text updates.',
    );
    const pendingConsent = createSmsConsent(
      phone,
      'sms_preferences',
      now,
      'pending_confirmation',
    );
    const pending: Household = {
      ...household,
      phone,
      smsConsent: pendingConsent,
      updatedAt: now,
    };
    const pendingStart = await this.repository.beginSmsPreference({
      householdId: household.householdId,
      expectedUpdatedAt: household.updatedAt,
      expectedConsent: household.smsConsent,
      pendingConsent,
    });
    if (!pendingStart.started) {
      return pendingStart.household ?? household;
    }

    if (!this.householdMessenger) {
      throw new PublicError('SMS provider is temporarily unavailable', 503);
    }
    try {
      await this.householdMessenger.sendSmsPreferenceConfirmation({
        householdId: household.householdId,
        phone,
      });
    } catch {
      throw new PublicError('SMS provider is temporarily unavailable', 503);
    }

    const activatedAt = new Date().toISOString();
    return (
      (await this.repository.activateSmsPreference({
        householdId: household.householdId,
        expectedPending: pendingConsent,
        activatedAt,
      })) ?? pending
    );
  }

  async requestRsvpRecovery(
    input: unknown,
    requestContext: { sourceIp?: string; baseUrl: string },
  ): Promise<RsvpRecoveryAcceptedResponse> {
    const parsed = RsvpRecoveryRequestSchema.safeParse(input);
    if (!parsed.success) {
      throw new PublicError(
        'Recovery contact is invalid',
        422,
        formatValidationIssues(parsed.error),
      );
    }

    const contact = normalizeRecoveryContact(parsed.data.contact);
    const contactHash = stableHash(
      `recovery-contact:${contact.kind}:${contact.value}`,
      this.inviteCodePepper,
    );
    const sourceIpHash = stableHash(
      `recovery-ip:${requestContext.sourceIp?.trim() || 'unknown'}`,
      this.inviteCodePepper,
    );
    const rateLimited = await this.isRsvpRecoveryRateLimited(
      contactHash,
      sourceIpHash,
    );
    if (rateLimited) {
      logStructured({
        level: 'warn',
        event: 'recovery.request.rateLimited',
        message: 'RSVP recovery rate limited',
        contactKind: contact.kind,
        outcome: 'rate_limited',
      });
      return acceptedRecoveryResponse();
    }

    const households =
      contact.kind === 'email'
        ? await this.repository.listHouseholdsByEmail(contact.value)
        : await this.repository.listHouseholdsByPhone(contact.value);

    if (households.length === 0) {
      logStructured({
        level: 'info',
        event: 'recovery.request.accepted',
        message: 'RSVP recovery accepted',
        contactKind: contact.kind,
        outcome: 'accepted',
      });
      return acceptedRecoveryResponse();
    }

    for (const household of households) {
      if (
        household.archivedAt ||
        household.inviteLifecycleStatus === 'archived'
      ) {
        continue;
      }

      if (
        contact.kind === 'phone' &&
        !(
          household.phone === contact.value &&
          household.smsConsent?.status === 'opted_in' &&
          household.smsConsent.phone === contact.value
        )
      ) {
        continue;
      }

      try {
        const inviteCode = await this.getRecoverableInviteCode(household);
        if (!inviteCode) {
          continue;
        }

        const invitation = this.buildInvitationDetails(
          household,
          inviteCode,
          requestContext.baseUrl,
        );
        if (!this.householdMessenger) {
          continue;
        }
        if (contact.kind === 'email') {
          await this.householdMessenger.sendRecoveryEmail({
            household,
            invitation,
          });
          logStructured({
            level: 'info',
            event: 'recovery.delivery.completed',
            message: 'RSVP recovery delivery succeeded',
            householdId: household.householdId,
            contactKind: contact.kind,
            channel: 'email',
            outcome: 'success',
          });
        } else {
          await this.householdMessenger.sendRecoverySms({
            household,
            invitation,
          });
          logStructured({
            level: 'info',
            event: 'recovery.delivery.completed',
            message: 'RSVP recovery delivery succeeded',
            householdId: household.householdId,
            contactKind: contact.kind,
            channel: 'sms',
            outcome: 'success',
          });
        }
      } catch (error) {
        logStructured({
          level: 'error',
          event: 'recovery.delivery.failed',
          message: 'RSVP recovery delivery failed',
          householdId: household.householdId,
          contactKind: contact.kind,
          channel: contact.kind === 'email' ? 'email' : 'sms',
          outcome: 'failed',
          ...describeError(error),
          statusCode: getErrorStatusCode(error),
        });
      }
    }

    logStructured({
      level: 'info',
      event: 'recovery.request.accepted',
      message: 'RSVP recovery accepted',
      contactKind: contact.kind,
      outcome: 'accepted',
    });
    return acceptedRecoveryResponse();
  }

  async listHouseholds(): Promise<AdminHouseholdRecord[]> {
    const households = await this.repository.listHouseholds();
    const result = await Promise.all(
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
    logStructured({
      level: 'info',
      event: 'admin.households.listed',
      message: 'Households listed',
      outcome: 'success',
      recordCount: result.length,
    });
    return result;
  }

  async createHousehold(input: unknown): Promise<Household> {
    const parsed = CreateHouseholdInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new PublicError(
        'Household validation failed',
        422,
        formatValidationIssues(parsed.error),
      );
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
    logStructured({
      level: 'info',
      event: 'admin.household.created',
      message: 'Household created',
      householdId,
      outcome: 'success',
      memberCount: household.members.length,
    });
    return household;
  }

  async importHouseholds(
    csv: string,
  ): Promise<{ imported: number; households: Household[] }> {
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

    const result = { imported: ids.size, households };
    logStructured({
      level: 'info',
      event: 'admin.households.imported',
      message: 'Households imported',
      outcome: 'success',
      recordCount: rawRows.length,
      importedCount: ids.size,
    });
    return result;
  }

  async updateHousehold(
    householdId: string,
    input: unknown,
  ): Promise<Household> {
    const household = await this.requireHousehold(householdId);
    const parsed = UpdateHouseholdInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new PublicError(
        'Household validation failed',
        422,
        formatValidationIssues(parsed.error),
      );
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
    logStructured({
      level: 'info',
      event: 'admin.household.updated',
      message: 'Household updated',
      householdId,
      outcome: 'success',
      memberCount: updated.members.length,
    });
    return updated;
  }

  async updateHouseholdMember(
    householdId: string,
    memberId: string,
    input: unknown,
  ): Promise<Household> {
    const household = await this.requireHousehold(householdId);
    const parsed = UpdateHouseholdMemberInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new PublicError(
        'Household member validation failed',
        422,
        formatValidationIssues(parsed.error),
      );
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
    logStructured({
      level: 'info',
      event: 'admin.householdMember.updated',
      message: 'Household member updated',
      householdId,
      outcome: 'success',
      memberCount: updated.members.length,
    });
    return updated;
  }

  async removeHouseholdMember(
    householdId: string,
    memberId: string,
  ): Promise<Household> {
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
          entry.id === memberId
            ? { ...entry, archivedAt: entry.archivedAt ?? now }
            : entry,
        ),
        updatedAt: now,
      };
      await this.repository.saveHousehold(updated);
      logStructured({
        level: 'info',
        event: 'admin.householdMember.removed',
        message: 'Household member archived',
        householdId,
        outcome: 'success',
        memberCount: updated.members.length,
      });
      return updated;
    }

    if (household.members.filter((entry) => !entry.archivedAt).length <= 1) {
      throw new PublicError(
        'Households must keep at least one active member',
        422,
      );
    }

    const updated = {
      ...household,
      members: household.members.filter((entry) => entry.id !== memberId),
      updatedAt: now,
    };
    await this.repository.saveHousehold(updated);
    logStructured({
      level: 'info',
      event: 'admin.householdMember.removed',
      message: 'Household member removed',
      householdId,
      outcome: 'success',
      memberCount: updated.members.length,
    });
    return updated;
  }

  async archiveHousehold(householdId: string): Promise<Household> {
    const household = await this.requireHousehold(householdId);
    if (
      household.archivedAt ||
      household.inviteLifecycleStatus === 'archived'
    ) {
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
    logStructured({
      level: 'info',
      event: 'admin.household.archived',
      message: 'Household archived',
      householdId,
      outcome: 'success',
      lifecycleStatus: 'archived',
    });
    return updated;
  }

  async updateInviteLifecycle(
    householdId: string,
    input: unknown,
  ): Promise<Household> {
    const household = await this.requireHousehold(householdId);
    const parsed = InviteLifecycleUpdateSchema.safeParse(input);
    if (!parsed.success) {
      throw new PublicError(
        'Invite lifecycle update is invalid',
        422,
        formatValidationIssues(parsed.error),
      );
    }

    if (parsed.data.status === 'not_generated') {
      throw new PublicError(
        'Invite lifecycle cannot move back to not generated',
        422,
      );
    }
    if (
      parsed.data.status === 'generated' &&
      household.inviteLifecycleStatus !== 'not_generated'
    ) {
      throw new PublicError(
        'Invite lifecycle cannot move back to generated',
        422,
      );
    }
    if (
      parsed.data.status === 'sent' &&
      household.inviteLifecycleStatus !== 'exported'
    ) {
      throw new PublicError(
        'Invitations must be exported before they are marked sent',
        422,
      );
    }

    const now = new Date().toISOString();
    const updated: Household = {
      ...household,
      inviteLifecycleStatus: parsed.data.status,
      inviteExportedAt:
        parsed.data.status === 'exported'
          ? (household.inviteExportedAt ?? now)
          : household.inviteExportedAt,
      inviteSentAt:
        parsed.data.status === 'sent'
          ? (household.inviteSentAt ?? now)
          : household.inviteSentAt,
      archivedAt:
        parsed.data.status === 'archived'
          ? (household.archivedAt ?? now)
          : household.archivedAt,
      updatedAt: now,
    };
    await this.repository.saveHousehold(updated);
    logStructured({
      level: 'info',
      event: 'admin.inviteLifecycle.updated',
      message: 'Invite lifecycle updated',
      householdId,
      outcome: 'success',
      fromStatus: household.inviteLifecycleStatus,
      toStatus: parsed.data.status,
      lifecycleStatus: parsed.data.status,
    });
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
    this.validateInviteRotationAllowed(
      household,
      options.confirmRotation === true,
    );

    const rotatedAt = new Date().toISOString();
    const inviteCode = generateInviteCode();
    const inviteCodeHash = hashInviteCode(inviteCode, this.inviteCodePepper);
    await this.saveInviteCodeArtifacts(
      householdId,
      inviteCode,
      inviteCodeHash,
      rotatedAt,
    );
    await this.repository.saveHousehold({
      ...household,
      inviteLifecycleStatus: 'generated',
      inviteCodeHash,
      inviteCodeGeneratedAt: household.inviteCodeGeneratedAt ?? rotatedAt,
      inviteCodeLastRotatedAt: rotatedAt,
      updatedAt: rotatedAt,
    });
    logStructured({
      level: 'info',
      event: 'admin.inviteCode.rotated',
      message: 'Invite code rotated',
      householdId,
      outcome: 'success',
      fromStatus: household.inviteLifecycleStatus,
      toStatus: 'generated',
      lifecycleStatus: 'generated',
    });

    return { inviteCode, inviteCodeHash };
  }

  async revealInvitation(
    householdId: string,
    baseUrl: string,
  ): Promise<InvitationDetails> {
    const household = await this.requireHousehold(householdId);
    if (
      household.archivedAt ||
      household.inviteLifecycleStatus === 'archived'
    ) {
      throw new PublicError(
        'Archived household invitations cannot be revealed',
        409,
      );
    }

    const inviteCode = await this.getRecoverableInviteCode(household);
    if (!inviteCode || !household.inviteCodeHash) {
      throw new PublicError(
        'This invitation does not have a recoverable invite code',
        404,
      );
    }

    logStructured({
      level: 'info',
      event: 'invitation.revealed',
      message: 'Invitation revealed',
      householdId,
      outcome: 'success',
    });
    return this.buildInvitationDetails(household, inviteCode, baseUrl);
  }

  async sendInvitationEmail(
    householdId: string,
    baseUrl: string,
  ): Promise<SendInvitationEmailResponse> {
    const household = await this.requireHousehold(householdId);
    if (
      household.archivedAt ||
      household.inviteLifecycleStatus === 'archived'
    ) {
      return {
        result: invitationEmailResult(
          household,
          'skipped',
          'Archived households cannot receive invitation emails',
        ),
      };
    }
    if (!household.email) {
      return {
        result: invitationEmailResult(
          household,
          'skipped',
          'Household does not have a contact email address',
        ),
      };
    }
    if (!this.householdMessenger) {
      throw new PublicError(
        'Outbound household notifications are not available',
        503,
      );
    }

    const invitation = await this.ensureRecoverableInvitation(
      household,
      baseUrl,
    );
    try {
      const result = await this.householdMessenger.sendInvitationEmail({
        household,
        invitation,
      });
      await this.markInvitationSent(household);
      logStructured({
        level: 'info',
        event: 'invitation.email.processed',
        message: 'Invitation email processed',
        householdId,
        outcome: result.status === 'sent' ? 'success' : result.status,
        channel: 'email',
      });
      return { result, invitation };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to send invitation email';
      logStructured({
        level: 'error',
        event: 'invitation.email.failed',
        message: 'Invitation email failed',
        householdId,
        channel: 'email',
        outcome: 'failed',
        ...describeError(error),
        statusCode: getErrorStatusCode(error),
      });
      return {
        invitation,
        result: invitationEmailResult(household, 'failed', message),
      };
    }
  }

  async sendInvitationEmails(
    baseUrl: string,
  ): Promise<BulkInvitationEmailResponse> {
    const households = (await this.repository.listHouseholds()).filter(
      (household) =>
        !household.archivedAt && household.inviteLifecycleStatus !== 'archived',
    );
    const results: InvitationEmailResult[] = [];

    for (const household of households) {
      try {
        const response = await this.sendInvitationEmail(
          household.householdId,
          baseUrl,
        );
        results.push(response.result);
      } catch (error) {
        results.push(
          invitationEmailResult(
            household,
            'failed',
            error instanceof Error
              ? error.message
              : 'Unable to send invitation email',
          ),
        );
      }
    }

    const summary = summarizeInvitationEmailResults(results);
    logStructured({
      level: 'info',
      event: 'invitation.email.bulkCompleted',
      message: 'Invitation email bulk send completed',
      outcome: 'success',
      recordCount: households.length,
      sentCount: summary.sentCount,
      skippedCount: summary.skippedCount,
      failedCount: summary.failedCount,
    });
    return { results };
  }

  async sendHouseholdNotification(
    householdId: string,
    input: unknown,
  ): Promise<SendHouseholdNotificationResponse> {
    const household = await this.requireHousehold(householdId);
    if (
      household.archivedAt ||
      household.inviteLifecycleStatus === 'archived'
    ) {
      throw new PublicError(
        'Archived households cannot receive guest notifications',
        409,
      );
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
      throw new PublicError(
        'Outbound household notifications are not available',
        503,
      );
    }

    const payload = parsed.data;
    if (payload.channel === 'email' && !household.email) {
      throw new PublicError(
        'This household does not have a contact email address',
        422,
      );
    }
    const smsDeliveryPhone =
      payload.channel === 'sms'
        ? resolveSmsDeliveryPhone(household)
        : undefined;
    if (payload.channel === 'sms' && !smsDeliveryPhone) {
      throw new PublicError(
        household.phone
          ? 'This household has not opted in to SMS updates'
          : 'This household does not have a mobile number for SMS',
        422,
      );
    }

    try {
      const result = await this.householdMessenger.sendHouseholdNotification({
        household:
          payload.channel === 'sms' && smsDeliveryPhone
            ? { ...household, phone: smsDeliveryPhone }
            : household,
        ...payload,
      });
      logStructured({
        level: 'info',
        event: 'notification.household.completed',
        message: 'Household notification delivered',
        householdId,
        channel: result.channel,
        outcome: 'success',
      });
      return result;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to send household notification';
      logStructured({
        level: 'error',
        event: 'notification.household.failed',
        message: 'Household notification failed',
        householdId,
        channel: payload.channel,
        outcome: 'failed',
        ...describeError(error),
        statusCode: getErrorStatusCode(error),
      });
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
    const csv = rsvpsToCsv(rows);
    logStructured({
      level: 'info',
      event: 'admin.rsvps.exported',
      message: 'RSVP export generated',
      outcome: 'success',
      recordCount: rows.length,
    });
    return csv;
  }

  async exportInvitations(baseUrl: string): Promise<string> {
    const rows = await this.prepareInvitationExportRows(baseUrl);
    const csvRows = await Promise.all(
      rows.map(async ({ household, rsvpUrl }) => ({
        household,
        rsvpUrl,
        qrCodeDataUrl: rsvpUrl
          ? await QRCode.toDataURL(rsvpUrl, { margin: 1, width: 256 })
          : '',
      })),
    );
    const csv = invitationExportToCsv(csvRows);
    logStructured({
      level: 'info',
      event: 'invitation.exported',
      message: 'Invitation export generated',
      outcome: 'success',
      recordCount: csvRows.length,
    });
    return csv;
  }

  async exportInvitationLabels(baseUrl: string): Promise<Buffer> {
    const rows = await this.prepareInvitationExportRows(baseUrl);
    const pdf = await createInvitationLabelsPdf(rows.filter((row) => row.rsvpUrl));
    logStructured({
      level: 'info',
      event: 'invitation.labels.exported',
      message: 'Invitation label export generated',
      outcome: 'success',
      recordCount: rows.length,
    });
    return pdf;
  }

  private async ensureRecoverableInvitation(
    household: Household,
    baseUrl: string,
  ): Promise<InvitationDetails> {
    const existingInviteCode = await this.getRecoverableInviteCode(household);
    if (existingInviteCode && household.inviteCodeHash) {
      return this.buildInvitationDetails(
        household,
        existingInviteCode,
        baseUrl,
      );
    }

    if (household.inviteCodeHash) {
      throw new PublicError(
        'This invitation code exists but is not recoverable. Rotate it before emailing.',
        409,
      );
    }

    const now = new Date().toISOString();
    const inviteCode = generateInviteCode();
    const inviteCodeHash = hashInviteCode(inviteCode, this.inviteCodePepper);
    await this.saveInviteCodeArtifacts(
      household.householdId,
      inviteCode,
      inviteCodeHash,
      now,
    );
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
      throw new PublicError(
        'Recoverable invite-code storage is not configured',
        503,
      );
    }

    await this.repository.saveInviteCodeLookup({
      householdId,
      inviteCodeHash,
      createdAt: timestamp,
    });
    await this.repository.saveInviteCodeSecret({
      householdId,
      inviteCodeHash,
      inviteCodeCiphertext:
        await this.inviteCodeProtector.encryptInviteCode(inviteCode),
      updatedAt: timestamp,
    });
  }

  private async getRecoverableInviteCode(
    household: Household,
  ): Promise<string | undefined> {
    if (!household.inviteCodeHash || !this.inviteCodeProtector) {
      return undefined;
    }

    const secret = await this.repository.getInviteCodeSecret(
      household.householdId,
    );
    if (!secret || secret.inviteCodeHash !== household.inviteCodeHash) {
      return undefined;
    }

    const inviteCode = await this.inviteCodeProtector.decryptInviteCode(
      secret.inviteCodeCiphertext,
    );
    if (
      !inviteCodeMatchesHash(
        inviteCode,
        household.inviteCodeHash,
        this.inviteCodePepper,
      )
    ) {
      throw new PublicError(
        'Stored invite code does not match the current household invite hash',
        409,
      );
    }

    return inviteCode;
  }

  private async prepareInvitationExportRows(
    baseUrl: string,
  ): Promise<PreparedInvitationExportRow[]> {
    const households = (await this.repository.listHouseholds()).filter(
      (household) =>
        !household.archivedAt && household.inviteLifecycleStatus !== 'archived',
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
          websiteUrl: baseUrl.replace(/\/$/, ''),
        });
        continue;
      }

      const inviteCodeHash = hashInviteCode(inviteCode, this.inviteCodePepper);
      if (!household.inviteCodeHash) {
        await this.saveInviteCodeArtifacts(
          household.householdId,
          inviteCode,
          inviteCodeHash,
          now,
        );
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
        inviteCode,
        rsvpUrl: `${baseUrl.replace(/\/$/, '')}/rsvp/${encodeURIComponent(inviteCode)}`,
        websiteUrl: baseUrl.replace(/\/$/, ''),
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
      inviteCodeHash:
        household.inviteCodeHash ??
        hashInviteCode(inviteCode, this.inviteCodePepper),
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

  private async findHouseholdByInviteCode(
    inviteCode: string,
  ): Promise<Household> {
    for (const hash of getInviteCodeHashes(inviteCode, this.inviteCodePepper)) {
      const household = await this.repository.getHouseholdByInviteHash(hash);
      if (!household) {
        continue;
      }
      if (
        household.archivedAt ||
        household.inviteLifecycleStatus === 'archived'
      ) {
        break;
      }
      if (
        household.inviteCodeHash &&
        inviteCodeMatchesHash(
          inviteCode,
          household.inviteCodeHash,
          this.inviteCodePepper,
        )
      ) {
        return household;
      }
    }

    throw new PublicError(GenericInviteError, 404);
  }

  private async requireHousehold(householdId: string): Promise<Household> {
    const household = await this.repository.getHousehold(householdId);
    if (!household) {
      throw new PublicError('Household not found', 404);
    }
    return household;
  }

  private async getStoredRsvp(
    householdId: string,
  ): Promise<StoredRsvp | undefined> {
    return this.repository.getRsvp(householdId);
  }

  private async isRsvpRecoveryRateLimited(
    contactHash: string,
    sourceIpHash: string,
  ): Promise<boolean> {
    const now = Date.now();
    const windowStartsAt =
      Math.floor(now / RSVP_RECOVERY_RATE_LIMIT_WINDOW_MS) *
      RSVP_RECOVERY_RATE_LIMIT_WINDOW_MS;
    const windowExpiresAt = windowStartsAt + RSVP_RECOVERY_RATE_LIMIT_WINDOW_MS;
    const contactAttempts = await this.recordRsvpRecoveryAttempt(
      'contact',
      contactHash,
      windowStartsAt,
      windowExpiresAt,
    );
    const ipAttempts = await this.recordRsvpRecoveryAttempt(
      'ip',
      sourceIpHash,
      windowStartsAt,
      windowExpiresAt,
    );
    return (
      contactAttempts > RSVP_RECOVERY_CONTACT_LIMIT ||
      ipAttempts > RSVP_RECOVERY_IP_LIMIT
    );
  }

  private async recordRsvpRecoveryAttempt(
    scope: 'contact' | 'ip',
    keyHash: string,
    windowStartsAt: number,
    windowExpiresAt: number,
  ): Promise<number> {
    return this.repository.recordRecoveryRateLimitAttempt({
      scope,
      keyHash,
      windowStartsAt,
      attempts: 0,
      windowExpiresAt,
      updatedAt: new Date().toISOString(),
    });
  }

  private validateRsvpAgainstHousehold(
    household: Household,
    rsvp: RsvpUpdate,
  ): void {
    const activeMembers = household.members.filter(
      (member) => !member.archivedAt,
    );
    const allowedMemberIds = new Set(activeMembers.map((member) => member.id));
    const submittedMemberIds = new Set(
      rsvp.members.map((member) => member.memberId),
    );
    const attendingMemberIds = new Set(
      rsvp.members
        .filter((member) => member.attending)
        .map((member) => member.memberId),
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
      activeMembers
        .filter((member) => member.canBringPlusOne)
        .map((member) => member.id),
    );
    if (rsvp.plusOnes.length > household.maxPlusOnes) {
      throw new PublicError('RSVP includes too many plus-ones', 422);
    }

    for (const plusOne of rsvp.plusOnes) {
      if (!plusOneAllowedMemberIds.has(plusOne.sponsorMemberId)) {
        throw new PublicError(
          'This household is not allowed to add that plus-one',
          422,
        );
      }
      if (!attendingMemberIds.has(plusOne.sponsorMemberId)) {
        throw new PublicError('A plus-one sponsor must be attending', 422);
      }
    }
  }

  private validateInviteRotationAllowed(
    household: Household,
    confirmed: boolean,
  ): void {
    if (household.inviteLifecycleStatus === 'sent') {
      throw new PublicError(
        'Sent invitations cannot be rotated. Archive the household or contact guests directly.',
        409,
      );
    }
    if (household.inviteLifecycleStatus === 'archived') {
      throw new PublicError(
        'Archived household invite codes cannot be rotated',
        409,
      );
    }
    if (household.inviteLifecycleStatus === 'exported' && !confirmed) {
      throw new PublicError(
        'Rotating an exported invite requires explicit confirmation',
        409,
      );
    }
  }

  private async notifyRsvpChanged(
    household: Household,
    rsvp: StoredRsvp,
  ): Promise<void> {
    if (!this.rsvpNotifier) {
      return;
    }

    try {
      await this.rsvpNotifier.notifyRsvpChanged({ household, rsvp });
    } catch (error) {
      logStructured({
        level: 'error',
        event: 'notification.rsvpAdmin.failed',
        message: 'RSVP admin notification failed',
        householdId: household.householdId,
        outcome: 'failed',
        ...describeError(error),
        statusCode: getErrorStatusCode(error),
      });
    }
  }
}

function createInvitationLabelsPdf(
  rows: PreparedInvitationExportRow[],
): Promise<Buffer> {
  const labelsPerPage = AVERY_5160_LABEL.columns * AVERY_5160_LABEL.rows;
  const pageCount = Math.max(1, Math.ceil(rows.length / labelsPerPage));
  const pageStreams = Array.from({ length: pageCount }, (_, pageIndex) => {
    const pageRows = rows.slice(
      pageIndex * labelsPerPage,
      (pageIndex + 1) * labelsPerPage,
    );
    return pageRows
      .map((row, index) => drawInvitationLabel(row, index))
      .join('\n');
  });

  return Promise.resolve(buildPdf(pageStreams));
}

function drawInvitationLabel(
  row: PreparedInvitationExportRow,
  pageLabelIndex: number,
): string {
  const column = pageLabelIndex % AVERY_5160_LABEL.columns;
  const labelRow = Math.floor(pageLabelIndex / AVERY_5160_LABEL.columns);
  const x =
    AVERY_5160_LABEL.marginLeft + column * AVERY_5160_LABEL.horizontalPitch;
  const y =
    AVERY_5160_LABEL.marginTop + labelRow * AVERY_5160_LABEL.verticalPitch;
  const qrSize = 54;
  const qrX = x + 8;
  const qrY = y + 9;
  const textX = qrX + qrSize + 8;
  const textWidth = AVERY_5160_LABEL.labelWidth - (textX - x) - 8;
  const householdText = truncatePdfText(
    row.household.displayName,
    Math.floor(textWidth / 4.3),
  );
  const inviteCodeText = truncatePdfText(
    row.inviteCode ? `Code: ${row.inviteCode}` : 'Code unavailable',
    Math.floor(textWidth / 3.4),
  );
  const websiteText = truncatePdfText(
    row.websiteUrl,
    Math.floor(textWidth / 2.8),
  );

  return [
    drawQrCode(row.rsvpUrl, qrX, qrY, qrSize),
    textCommand(householdText, textX, y + 17, 7.5, 'F2', '0.141 0.196 0.220'),
    textCommand(inviteCodeText, textX, y + 33, 6.5, 'F1', '0.141 0.196 0.220'),
    textCommand('Website:', textX, y + 47, 5.5, 'F2', '0.322 0.384 0.373'),
    textCommand(websiteText, textX, y + 58, 5, 'F1', '0.322 0.384 0.373'),
  ].join('\n');
}

function drawQrCode(value: string, x: number, y: number, size: number): string {
  const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
  const quietModules = 2;
  const totalModules = qr.modules.size + quietModules * 2;
  const moduleSize = size / totalModules;
  const commands = [
    'q',
    '1 1 1 rg',
    `${formatPdfNumber(x)} ${formatPdfNumber(toPdfY(y + size))} ${formatPdfNumber(size)} ${formatPdfNumber(size)} re`,
    'f',
    '0 0 0 rg',
  ];

  for (let row = 0; row < qr.modules.size; row += 1) {
    for (let column = 0; column < qr.modules.size; column += 1) {
      if (qr.modules.get(row, column)) {
        commands.push(
          `${formatPdfNumber(x + (column + quietModules) * moduleSize)} ${formatPdfNumber(
            toPdfY(y + (row + quietModules + 1) * moduleSize),
          )} ${formatPdfNumber(moduleSize)} ${formatPdfNumber(moduleSize)} re`,
        );
      }
    }
  }
  commands.push('f', 'Q');
  return commands.join('\n');
}

function buildPdf(pageStreams: string[]): Buffer {
  const objects: string[] = [];
  const pageObjectIds: number[] = [];

  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';

  for (const stream of pageStreams) {
    const contentObjectId = objects.length;
    objects[contentObjectId] =
      `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream`;

    const pageObjectId = objects.length;
    pageObjectIds.push(pageObjectId);
    objects[pageObjectId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${formatPdfNumber(AVERY_5160_LABEL.pageWidth)} ${formatPdfNumber(
        AVERY_5160_LABEL.pageHeight,
      )}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectId} 0 R >>`;
  }

  objects[2] = `<< /Type /Pages /Count ${pageObjectIds.length} /Kids [${pageObjectIds
    .map((id) => `${id} 0 R`)
    .join(' ')}] >>`;

  const chunks: Buffer[] = [Buffer.from('%PDF-1.4\n', 'ascii')];
  const offsets = [0];
  for (let objectId = 1; objectId < objects.length; objectId += 1) {
    offsets[objectId] = Buffer.concat(chunks).length;
    chunks.push(
      Buffer.from(`${objectId} 0 obj\n${objects[objectId]}\nendobj\n`, 'ascii'),
    );
  }

  const xrefOffset = Buffer.concat(chunks).length;
  const xrefRows = offsets
    .slice(1)
    .map((offset) => `${offset.toString().padStart(10, '0')} 00000 n `)
    .join('\n');
  chunks.push(
    Buffer.from(
      `xref\n0 ${objects.length}\n0000000000 65535 f \n${xrefRows}\ntrailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
      'ascii',
    ),
  );

  return Buffer.concat(chunks);
}

function textCommand(
  value: string,
  x: number,
  y: number,
  fontSize: number,
  fontResource: 'F1' | 'F2',
  rgb: string,
): string {
  return [
    'BT',
    `${rgb} rg`,
    `/${fontResource} ${formatPdfNumber(fontSize)} Tf`,
    `1 0 0 1 ${formatPdfNumber(x)} ${formatPdfNumber(toPdfY(y))} Tm`,
    `(${escapePdfString(value)}) Tj`,
    'ET',
  ].join('\n');
}

function truncatePdfText(value: string, maxLength: number): string {
  const normalized = value.replace(/[^\x20-\x7e]/g, '?').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function escapePdfString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function toPdfY(y: number): number {
  return AVERY_5160_LABEL.pageHeight - y;
}

function formatPdfNumber(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}

function normalizeImportedHouseholdRow(
  row: HouseholdImportRow,
  rowNumber: number,
): HouseholdImportRow {
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

function normalizeOptionalPhoneNumber(
  value: string | undefined,
): string | undefined {
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

function normalizeRequiredPhoneNumber(
  value: string | undefined,
  message: string,
): string {
  const normalized = normalizeOptionalPhoneNumber(value);
  if (!normalized) {
    throw new PublicError(message, 422, [`smsPhone: ${message}`]);
  }

  return normalized;
}

type RecoveryContact =
  | { kind: 'email'; value: string }
  | { kind: 'phone'; value: string };

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

function createSmsConsent(
  phone: string,
  source: SmsConsent['source'],
  consentedAt: string,
  status: SmsConsent['status'] = 'opted_in',
): SmsConsent {
  return {
    status,
    phone,
    source,
    consentedAt,
    consentTextVersion: SMS_CONSENT_TEXT_VERSION,
  };
}

function resolveSmsDeliveryPhone(household: Household): string | undefined {
  return household.phone &&
    household.smsConsent?.status === 'opted_in' &&
    household.smsConsent.phone === household.phone
    ? household.phone
    : undefined;
}

function summarizeAttendance(
  household: Household,
  rsvp?: StoredRsvp,
): AdminHouseholdRecord['attendance'] {
  if (!rsvp) {
    return {
      invitedGuests:
        household.members.filter((member) => !member.archivedAt).length +
        household.maxPlusOnes,
      attendingGuests: 0,
      declinedGuests: 0,
      pendingGuests: household.members.filter((member) => !member.archivedAt)
        .length,
      plusOneGuests: 0,
    };
  }

  const attendingGuests =
    rsvp.members.filter((member) => member.attending).length +
    rsvp.plusOnes.length;
  const declinedGuests = rsvp.members.filter(
    (member) => !member.attending,
  ).length;

  return {
    invitedGuests: household.members.length + household.maxPlusOnes,
    attendingGuests,
    declinedGuests,
    pendingGuests: 0,
    plusOneGuests: rsvp.plusOnes.length,
  };
}

function summarizeRsvpCounts(rsvp: StoredRsvp): {
  attendingCount: number;
  declinedCount: number;
  plusOneCount: number;
} {
  const attendingCount = rsvp.members.filter((member) => member.attending).length;
  const declinedCount = rsvp.members.length - attendingCount;
  return {
    attendingCount,
    declinedCount,
    plusOneCount: rsvp.plusOnes.length,
  };
}

function summarizeInvitationEmailResults(results: InvitationEmailResult[]): {
  sentCount: number;
  skippedCount: number;
  failedCount: number;
} {
  return results.reduce(
    (counts, result) => {
      if (result.status === 'sent') {
        counts.sentCount += 1;
      } else if (result.status === 'skipped') {
        counts.skippedCount += 1;
      } else {
        counts.failedCount += 1;
      }
      return counts;
    },
    { sentCount: 0, skippedCount: 0, failedCount: 0 },
  );
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
