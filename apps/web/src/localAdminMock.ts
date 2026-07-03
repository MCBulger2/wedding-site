import type {
  AdminHouseholdRecord,
  CreateHouseholdInput,
  Household,
  InvitationDetails,
  InvitationEmailResult,
  InviteLifecycleStatus,
  SendHouseholdNotificationInput,
  SendHouseholdNotificationResponse,
  UpdateHouseholdInput,
  UpdateHouseholdMemberInput,
} from '@matt-alison-wedding/shared';
import type { AdminAuthConfig, AdminSession } from './adminAuth.js';
import type {
  AdminAuthConfigResponse,
  AdminHouseholdsResponse,
  BulkEmailInvitationsResponse,
  CreateHouseholdResponse,
  EmailInvitationResponse,
  RotateInviteCodeResponse,
  RevealInvitationResponse,
} from './api.js';

export const localAdminMockEnabled =
  import.meta.env.DEV &&
  import.meta.env.VITE_ENABLE_LOCAL_ADMIN_MOCKS === 'true';

export const localAdminMockToken = 'local-admin-mock-token';

export const localAdminMockAuthConfig: AdminAuthConfig = {
  clientId: 'local-admin-mock-client',
  userPoolDomain: window.location.origin,
  scopes: ['openid', 'email', 'profile'],
};

const baseTimestamp = '2026-06-15T22:00:00.000Z';

let nextHouseholdNumber = 5;
let nextInviteNumber = 456;
let records = createInitialRecords();

export function createLocalAdminMockSession(): AdminSession {
  return {
    accessToken: localAdminMockToken,
    idToken: createMockJwt({
      email: 'local-admin@example.com',
      name: 'Local Admin',
      'cognito:username': 'local-admin',
    }),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  };
}

export async function mockFetchAdminAuthConfig(): Promise<AdminAuthConfigResponse> {
  return localAdminMockAuthConfig;
}

export async function mockFetchHouseholds(): Promise<AdminHouseholdsResponse> {
  return { households: cloneRecords() };
}

export async function mockCreateHousehold(
  payload: CreateHouseholdInput,
): Promise<CreateHouseholdResponse> {
  const householdId = `local-${nextHouseholdNumber++}`;
  const now = new Date().toISOString();
  const household: Household = {
    householdId,
    displayName: payload.displayName,
    email: emptyToUndefined(payload.email),
    phone: emptyToUndefined(payload.phone),
    mailingAddress: payload.mailingAddress,
    members: payload.members.map((member, index) => ({
      id: `${householdId}-${index + 1}`,
      firstName: member.firstName,
      lastName: member.lastName,
      canBringPlusOne: member.canBringPlusOne,
      weddingPartyRole: emptyToUndefined(member.weddingPartyRole),
      rehearsalDinnerInvited: member.rehearsalDinnerInvited,
    })),
    maxPlusOnes: payload.maxPlusOnes,
    rsvpStatus: 'not_started',
    inviteLifecycleStatus: 'not_generated',
    createdAt: now,
    updatedAt: now,
  };

  records = [
    {
      household,
      attendance: attendanceFor(household, 0, 0, household.members.length, 0),
      hasRecoverableInviteCode: false,
    },
    ...records,
  ];

  return { household: clone(household) };
}

export async function mockUpdateHousehold(
  householdId: string,
  payload: UpdateHouseholdInput,
): Promise<CreateHouseholdResponse> {
  const record = requireRecord(householdId);
  const household: Household = {
    ...record.household,
    ...payload,
    email: emptyToUndefined(payload.email),
    phone: emptyToUndefined(payload.phone),
    updatedAt: new Date().toISOString(),
  };
  replaceRecord({ ...record, household });
  return { household: clone(household) };
}

export async function mockArchiveHousehold(
  householdId: string,
): Promise<CreateHouseholdResponse> {
  const record = requireRecord(householdId);
  const household: Household = {
    ...record.household,
    archivedAt: new Date().toISOString(),
    inviteLifecycleStatus: 'archived',
    updatedAt: new Date().toISOString(),
  };
  replaceRecord({ ...record, household });
  return { household: clone(household) };
}

export async function mockUpdateHouseholdMember(
  householdId: string,
  memberId: string,
  payload: UpdateHouseholdMemberInput,
): Promise<CreateHouseholdResponse> {
  const record = requireRecord(householdId);
  const household: Household = {
    ...record.household,
    members: record.household.members.map((member) =>
      member.id === memberId
        ? {
            ...member,
            ...payload,
            weddingPartyRole: emptyToUndefined(payload.weddingPartyRole),
          }
        : member,
    ),
    updatedAt: new Date().toISOString(),
  };
  replaceRecord({ ...record, household });
  return { household: clone(household) };
}

export async function mockRemoveHouseholdMember(
  householdId: string,
  memberId: string,
): Promise<CreateHouseholdResponse> {
  const record = requireRecord(householdId);
  const household: Household = {
    ...record.household,
    members: record.household.members.map((member) =>
      member.id === memberId
        ? { ...member, archivedAt: new Date().toISOString() }
        : member,
    ),
    updatedAt: new Date().toISOString(),
  };
  replaceRecord({ ...record, household });
  return { household: clone(household) };
}

export async function mockUpdateInviteLifecycleStatus(
  householdId: string,
  status: InviteLifecycleStatus,
): Promise<CreateHouseholdResponse> {
  const record = requireRecord(householdId);
  const now = new Date().toISOString();
  const household: Household = {
    ...record.household,
    inviteLifecycleStatus: status,
    inviteExportedAt:
      status === 'exported' ? now : record.household.inviteExportedAt,
    inviteSentAt: status === 'sent' ? now : record.household.inviteSentAt,
    updatedAt: now,
  };
  replaceRecord({ ...record, household });
  return { household: clone(household) };
}

export async function mockRotateInviteCode(
  householdId: string,
): Promise<RotateInviteCodeResponse> {
  const record = requireRecord(householdId);
  const now = new Date().toISOString();
  const inviteCode = nextInviteCode(record.household);
  const inviteCodeHash = `mock-hash-${inviteCode}`;
  const household: Household = {
    ...record.household,
    inviteLifecycleStatus: 'generated',
    inviteCodeHash,
    inviteCodeGeneratedAt: record.household.inviteCodeGeneratedAt ?? now,
    inviteCodeLastRotatedAt: now,
    updatedAt: now,
  };
  replaceRecord({ ...record, household, hasRecoverableInviteCode: true });
  return { inviteCode, inviteCodeHash };
}

export async function mockRevealInvitation(
  householdId: string,
): Promise<RevealInvitationResponse> {
  const record = requireRecord(householdId);
  if (!record.household.inviteCodeHash) {
    await mockRotateInviteCode(householdId);
  }

  return clone(invitationFor(requireRecord(householdId).household));
}

export async function mockEmailHouseholdInvitation(
  householdId: string,
): Promise<EmailInvitationResponse> {
  const record = requireRecord(householdId);
  const invitation = await mockRevealInvitation(householdId);
  const result = invitationEmailResult(record);
  if (result.status === 'sent') {
    await mockUpdateInviteLifecycleStatus(householdId, 'sent');
  }

  return { invitation, result };
}

export async function mockEmailInvitations(): Promise<BulkEmailInvitationsResponse> {
  const results: InvitationEmailResult[] = [];
  for (const record of records) {
    if (isArchived(record.household)) {
      results.push({
        householdId: record.household.householdId,
        displayName: record.household.displayName,
        status: 'skipped',
        message: 'Archived household skipped',
      });
      continue;
    }

    results.push(invitationEmailResult(record));
    if (record.household.email) {
      await mockUpdateInviteLifecycleStatus(
        record.household.householdId,
        'sent',
      );
    }
  }

  return { results };
}

export async function mockSendHouseholdNotification(
  householdId: string,
  payload: SendHouseholdNotificationInput,
): Promise<SendHouseholdNotificationResponse> {
  const record = requireRecord(householdId);
  if (
    payload.channel === 'sms' &&
    (!record.household.phone ||
      record.household.smsConsent?.status !== 'opted_in' ||
      record.household.smsConsent.phone !== record.household.phone)
  ) {
    throw new Error('This household has not opted in to SMS updates');
  }
  const deliveredTo =
    payload.channel === 'email'
      ? record.household.email
      : record.household.phone;
  if (!deliveredTo) {
    throw new Error(
      `No ${payload.channel} contact is available for this household.`,
    );
  }

  return { channel: payload.channel, deliveredTo };
}

export async function mockDownloadRsvpsCsv(): Promise<Blob> {
  return csvBlob([
    'householdId,household,status,attending,pending',
    ...records.map(
      (record) =>
        `${record.household.householdId},"${record.household.displayName}",${record.household.rsvpStatus},${record.attendance.attendingGuests},${record.attendance.pendingGuests}`,
    ),
  ]);
}

export async function mockDownloadInvitationsCsv(): Promise<Blob> {
  records = records.map((record) =>
    isArchived(record.household)
      ? record
      : {
          ...record,
          household: {
            ...record.household,
            inviteLifecycleStatus:
              record.household.inviteLifecycleStatus === 'sent'
                ? 'sent'
                : 'exported',
            inviteExportedAt:
              record.household.inviteExportedAt ?? new Date().toISOString(),
          },
        },
  );

  return csvBlob([
    'householdId,household,rsvpUrl,qrCodeDataUrl',
    ...records.map((record) => {
      const invitation = invitationFor(record.household);
      return `${record.household.householdId},"${record.household.displayName}",${invitation.rsvpUrl},"data:image/png;base64,mock"`;
    }),
  ]);
}

function createInitialRecords(): AdminHouseholdRecord[] {
  const exampleHousehold: Household = {
    householdId: 'h1',
    displayName: 'The Example Household',
    email: 'sam@example.com',
    phone: '+14805550100',
    smsConsent: {
      status: 'opted_in',
      phone: '+14805550100',
      source: 'rsvp_form',
      consentedAt: baseTimestamp,
      consentTextVersion: 'twilio-tollfree-v1',
    },
    mailingAddress: {
      line1: '123 Main St',
      line2: '',
      city: 'Phoenix',
      state: 'AZ',
      postalCode: '85001',
      country: 'USA',
    },
    members: [
      {
        id: 'h1-1',
        firstName: 'Sam',
        lastName: 'Example',
        canBringPlusOne: true,
        weddingPartyRole: 'Best person',
        rehearsalDinnerInvited: true,
      },
      {
        id: 'h1-2',
        firstName: 'Taylor',
        lastName: 'Example',
        canBringPlusOne: false,
        rehearsalDinnerInvited: true,
      },
    ],
    maxPlusOnes: 1,
    rsvpStatus: 'partial',
    inviteLifecycleStatus: 'generated',
    inviteCodeHash: 'hash-value',
    inviteCodeLastRotatedAt: baseTimestamp,
    inviteCodeGeneratedAt: baseTimestamp,
    createdAt: baseTimestamp,
    updatedAt: baseTimestamp,
  };

  const attendingHousehold: Household = {
    householdId: 'h2',
    displayName: 'The Rivera Household',
    email: 'rivera@example.com',
    mailingAddress: {
      line1: '248 S Mountain View Rd',
      line2: 'Unit 8',
      city: 'Mesa',
      state: 'AZ',
      postalCode: '85207',
      country: 'USA',
    },
    members: [
      {
        id: 'h2-1',
        firstName: 'Jordan',
        lastName: 'Rivera',
        canBringPlusOne: false,
        rehearsalDinnerInvited: false,
      },
    ],
    maxPlusOnes: 0,
    rsvpStatus: 'attending',
    inviteLifecycleStatus: 'exported',
    inviteCodeHash: 'hash-rivera',
    inviteCodeGeneratedAt: '2026-06-16T16:00:00.000Z',
    inviteExportedAt: '2026-06-17T16:00:00.000Z',
    createdAt: '2026-06-16T16:00:00.000Z',
    updatedAt: '2026-06-17T16:00:00.000Z',
  };

  const declinedHousehold: Household = {
    householdId: 'h3',
    displayName: 'The Chen Household',
    phone: '+14805550199',
    mailingAddress: {
      line1: '901 E Baseline Rd',
      line2: '',
      city: 'Tempe',
      state: 'AZ',
      postalCode: '85283',
      country: 'USA',
    },
    members: [
      {
        id: 'h3-1',
        firstName: 'Avery',
        lastName: 'Chen',
        canBringPlusOne: false,
        rehearsalDinnerInvited: false,
      },
      {
        id: 'h3-2',
        firstName: 'Morgan',
        lastName: 'Chen',
        canBringPlusOne: false,
        rehearsalDinnerInvited: false,
      },
    ],
    maxPlusOnes: 0,
    rsvpStatus: 'declined',
    inviteLifecycleStatus: 'sent',
    inviteCodeHash: 'hash-chen',
    inviteCodeGeneratedAt: '2026-06-18T16:00:00.000Z',
    inviteExportedAt: '2026-06-19T16:00:00.000Z',
    inviteSentAt: '2026-06-20T16:00:00.000Z',
    createdAt: '2026-06-18T16:00:00.000Z',
    updatedAt: '2026-06-20T16:00:00.000Z',
  };

  const archivedHousehold: Household = {
    householdId: 'h4',
    displayName: 'Archived Test Household',
    email: 'archived@example.com',
    members: [
      {
        id: 'h4-1',
        firstName: 'Casey',
        lastName: 'Archive',
        canBringPlusOne: true,
        archivedAt: '2026-06-21T16:00:00.000Z',
      },
    ],
    maxPlusOnes: 1,
    rsvpStatus: 'not_started',
    inviteLifecycleStatus: 'archived',
    archivedAt: '2026-06-21T16:00:00.000Z',
    createdAt: '2026-06-12T16:00:00.000Z',
    updatedAt: '2026-06-21T16:00:00.000Z',
  };

  return [
    {
      household: exampleHousehold,
      attendance: attendanceFor(exampleHousehold, 2, 1, 0, 1),
      hasRecoverableInviteCode: true,
      rsvp: {
        members: [
          {
            memberId: 'h1-1',
            attending: true,
            mealChoice: 'buffet',
            dietaryNotes: '',
          },
          {
            memberId: 'h1-2',
            attending: false,
            mealChoice: 'none',
            dietaryNotes: '',
          },
        ],
        plusOnes: [
          {
            sponsorMemberId: 'h1-1',
            firstName: 'Jamie',
            lastName: 'Guest',
            mealChoice: 'buffet',
            dietaryNotes: 'Gluten-free dessert if available.',
          },
        ],
        notes: 'Excited to celebrate. We will arrive early for photos.',
        accessibilityNotes: 'Please seat near an aisle.',
        submittedAt: '2026-06-15T22:05:00.000Z',
        updatedAt: '2026-06-15T22:07:00.000Z',
      },
    },
    {
      household: attendingHousehold,
      attendance: attendanceFor(attendingHousehold, 1, 0, 0, 0),
      hasRecoverableInviteCode: true,
      rsvp: {
        members: [
          {
            memberId: 'h2-1',
            attending: true,
            mealChoice: 'vegetarian',
            dietaryNotes: 'No shellfish.',
          },
        ],
        plusOnes: [],
        notes: '',
        accessibilityNotes: '',
        submittedAt: '2026-06-17T17:00:00.000Z',
        updatedAt: '2026-06-17T17:00:00.000Z',
      },
    },
    {
      household: declinedHousehold,
      attendance: attendanceFor(declinedHousehold, 0, 2, 0, 0),
      hasRecoverableInviteCode: true,
      rsvp: {
        members: [
          {
            memberId: 'h3-1',
            attending: false,
            mealChoice: 'none',
            dietaryNotes: '',
          },
          {
            memberId: 'h3-2',
            attending: false,
            mealChoice: 'none',
            dietaryNotes: '',
          },
        ],
        plusOnes: [],
        notes: 'Sending love from afar.',
        accessibilityNotes: '',
        submittedAt: '2026-06-21T17:00:00.000Z',
        updatedAt: '2026-06-21T17:00:00.000Z',
      },
    },
    {
      household: archivedHousehold,
      attendance: attendanceFor(archivedHousehold, 0, 0, 1, 0),
      hasRecoverableInviteCode: false,
    },
  ];
}

function attendanceFor(
  household: Household,
  attendingGuests: number,
  declinedGuests: number,
  pendingGuests: number,
  plusOneGuests: number,
) {
  return {
    invitedGuests: household.members.length + household.maxPlusOnes,
    attendingGuests,
    declinedGuests,
    pendingGuests,
    plusOneGuests,
  };
}

function invitationEmailResult(
  record: AdminHouseholdRecord,
): InvitationEmailResult {
  if (!record.household.email) {
    return {
      householdId: record.household.householdId,
      displayName: record.household.displayName,
      status: 'skipped',
      message: 'Household does not have a contact email address',
    };
  }

  return {
    householdId: record.household.householdId,
    displayName: record.household.displayName,
    status: 'sent',
    deliveredTo: record.household.email,
    message: `Sent invitation email to ${record.household.email}`,
  };
}

function invitationFor(household: Household): InvitationDetails {
  const inviteCode = codeForHousehold(household);
  return {
    householdId: household.householdId,
    inviteCode,
    inviteCodeHash: household.inviteCodeHash ?? `mock-hash-${inviteCode}`,
    rsvpUrl: `${window.location.origin}/rsvp/${inviteCode}`,
  };
}

function codeForHousehold(household: Household): string {
  if (household.householdId === 'h1') return 'A2B3C4D5E6';
  if (household.householdId === 'h2') return 'R2V3R4A5B6';
  if (household.householdId === 'h3') return 'C2H3E4N5A6';
  return `LCL${household.householdId
    .replace(/[^a-z0-9]/gi, '')
    .toUpperCase()
    .padEnd(7, '2')
    .slice(0, 7)}`;
}

function nextInviteCode(household: Household): string {
  if (household.householdId.startsWith('local-')) {
    return `FRESH${String(nextInviteNumber++).padStart(5, '2')}`;
  }

  return codeForHousehold(household);
}

function replaceRecord(nextRecord: AdminHouseholdRecord): void {
  records = records.map((record) =>
    record.household.householdId === nextRecord.household.householdId
      ? nextRecord
      : record,
  );
}

function requireRecord(householdId: string): AdminHouseholdRecord {
  const record = records.find(
    (entry) => entry.household.householdId === householdId,
  );
  if (!record) {
    throw new Error('Household not found');
  }

  return record;
}

function createMockJwt(payload: Record<string, unknown>): string {
  return [
    base64UrlJson({ alg: 'none', typ: 'JWT' }),
    base64UrlJson(payload),
    'local-admin-mock',
  ].join('.');
}

function base64UrlJson(value: Record<string, unknown>): string {
  return window
    .btoa(JSON.stringify(value))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function csvBlob(lines: string[]): Blob {
  return new Blob([`${lines.join('\n')}\n`], {
    type: 'text/csv; charset=utf-8',
  });
}

function cloneRecords(): AdminHouseholdRecord[] {
  return clone(records);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function emptyToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function isArchived(household: Household): boolean {
  return (
    household.inviteLifecycleStatus === 'archived' ||
    Boolean(household.archivedAt)
  );
}
