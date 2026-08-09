import type {
  Household,
  RsvpRecoveryAcceptedResponse,
  RsvpSearchResponse,
  RsvpUpdate,
  SmsPreferencesRequest,
  StoredRsvp,
} from '@matt-alison-wedding/shared';

const baseTimestamp = '2026-06-15T22:00:00.000Z';
const localRsvpStorageKey = 'wedding.local-rsvp-mock.response';

export const localRsvpMockEnabled =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_LOCAL_RSVP_MOCKS === 'true';

const localRsvpHousehold: Household = {
  householdId: 'local-rsvp',
  displayName: 'The Example Household',
  email: 'sam@example.com',
  phone: '+14805550100',
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
      id: 'local-rsvp-1',
      firstName: 'Sam',
      lastName: 'Example',
      canBringPlusOne: true,
      weddingPartyRole: 'Best person',
      rehearsalDinnerInvited: true,
    },
    {
      id: 'local-rsvp-2',
      firstName: 'Taylor',
      lastName: 'Example',
      canBringPlusOne: false,
      rehearsalDinnerInvited: true,
    },
  ],
  maxPlusOnes: 1,
  rsvpStatus: 'not_started',
  inviteLifecycleStatus: 'generated',
  inviteCodeHash: 'local-rsvp-hash',
  inviteCodeGeneratedAt: baseTimestamp,
  inviteCodeLastRotatedAt: baseTimestamp,
  createdAt: baseTimestamp,
  updatedAt: baseTimestamp,
};

let localRsvp: StoredRsvp | undefined = readStoredRsvp();

export async function mockFetchRsvp(_inviteCode: string) {
  localRsvp = readStoredRsvp() ?? localRsvp;
  return {
    household: clone(localRsvpHousehold),
    rsvp: localRsvp ? clone(localRsvp) : undefined,
  };
}

export async function mockSaveRsvp(_inviteCode: string, payload: RsvpUpdate) {
  const now = new Date().toISOString();
  localRsvp = {
    ...clone(payload),
    submittedAt: localRsvp?.submittedAt ?? now,
    updatedAt: now,
  };
  writeStoredRsvp(localRsvp);
  return mockFetchRsvp(_inviteCode);
}

export async function mockSaveSmsPreferences(
  _inviteCode: string,
  _payload: SmsPreferencesRequest,
) {
  return clone(localRsvpHousehold);
}

export async function mockRecoverRsvpLink(
  _payload: unknown,
): Promise<RsvpRecoveryAcceptedResponse> {
  return {
    accepted: true,
    message: "If that matches our guest list, we'll send your private RSVP link.",
  };
}

export async function mockSearchRsvps({
  lastName,
}: {
  lastName: string;
}): Promise<RsvpSearchResponse> {
  const results =
    lastName.trim().toLowerCase() === 'example'
      ? [
          {
            displayName: localRsvpHousehold.displayName,
            rsvpUrl: `${getOrigin()}/rsvp/LOCALRSVP2027`,
          },
        ]
      : [];

  return { results, tooManyMatches: false };
}

function getOrigin(): string {
  return typeof window === 'undefined'
    ? 'http://localhost:5173'
    : window.location.origin;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function readStoredRsvp(): StoredRsvp | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  try {
    const stored = window.localStorage.getItem(localRsvpStorageKey);
    return stored ? (JSON.parse(stored) as StoredRsvp) : undefined;
  } catch {
    return undefined;
  }
}

function writeStoredRsvp(rsvp: StoredRsvp): void {
  try {
    window.localStorage.setItem(localRsvpStorageKey, JSON.stringify(rsvp));
  } catch {
    // Local mock persistence is best effort.
  }
}
