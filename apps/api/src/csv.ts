import type { Household, HouseholdImportRow, StoredRsvp } from '@matt-alison-wedding/shared';

export function parseCsv(input: string): Record<string, string>[] {
  const rows = toRows(input);
  if (rows.length < 2) {
    return [];
  }

  const [headers, ...values] = rows;
  return values
    .filter((row) => row.some((value) => value.trim().length > 0))
    .map((row) =>
      Object.fromEntries(headers.map((header, index) => [header.trim(), row[index]?.trim() ?? ''])),
    );
}

export function buildHouseholdsFromRows(rows: HouseholdImportRow[], now: string): Household[] {
  const byHousehold = new Map<string, Household>();

  for (const row of rows) {
    const existing = byHousehold.get(row.householdId);
    const member = {
      id: `${row.householdId}-${(existing?.members.length ?? 0) + 1}`,
      firstName: row.firstName,
      lastName: row.lastName,
      canBringPlusOne: row.canBringPlusOne,
      weddingPartyRole: row.weddingPartyRole,
      rehearsalDinnerInvited: row.rehearsalDinnerInvited,
    };

    if (!existing) {
      byHousehold.set(row.householdId, {
        householdId: row.householdId,
        displayName: row.displayName,
        email: row.email || undefined,
        phone: row.phone || undefined,
        mailingAddress: {
          line1: row.addressLine1,
          line2: row.addressLine2,
          city: row.city,
          state: row.state,
          postalCode: row.postalCode,
          country: row.country,
        },
        members: [member],
        maxPlusOnes: row.maxPlusOnes,
        rsvpStatus: 'not_started',
        inviteLifecycleStatus: 'not_generated',
        createdAt: now,
        updatedAt: now,
      });
    } else {
      existing.members.push(member);
      existing.maxPlusOnes = Math.max(existing.maxPlusOnes, row.maxPlusOnes);
      existing.updatedAt = now;
    }
  }

  return [...byHousehold.values()];
}

export function rsvpsToCsv(rows: Array<{ household: Household; rsvp?: StoredRsvp }>): string {
  const headers = [
    'householdId',
    'household',
    'email',
    'phone',
    'guestType',
    'memberId',
    'sponsorMemberId',
    'firstName',
    'lastName',
    'attending',
    'mealChoice',
    'dietaryNotes',
    'notes',
    'accessibilityNotes',
    'submittedAt',
    'updatedAt',
  ];

  const output = rows.flatMap(({ household, rsvp }) => {
    const memberRows = household.members.map((member) => {
      const memberRsvp = rsvp?.members.find((item) => item.memberId === member.id);
      return [
        household.householdId,
        household.displayName,
        household.email ?? '',
        household.phone ?? '',
        'household_member',
        member.id,
        '',
        member.firstName,
        member.lastName,
        memberRsvp?.attending ?? '',
        memberRsvp?.mealChoice ?? '',
        memberRsvp?.dietaryNotes ?? '',
        rsvp?.notes ?? '',
        rsvp?.accessibilityNotes ?? '',
        rsvp?.submittedAt ?? '',
        rsvp?.updatedAt ?? '',
      ];
    });

    const plusOneRows =
      rsvp?.plusOnes.map((plusOne, index) => [
        household.householdId,
        household.displayName,
        household.email ?? '',
        household.phone ?? '',
        'plus_one',
        `${household.householdId}-plus-one-${index + 1}`,
        plusOne.sponsorMemberId,
        plusOne.firstName,
        plusOne.lastName,
        true,
        plusOne.mealChoice,
        plusOne.dietaryNotes ?? '',
        rsvp.notes,
        rsvp.accessibilityNotes,
        rsvp.submittedAt,
        rsvp.updatedAt,
      ]) ?? [];

    return [...memberRows, ...plusOneRows];
  });

  return [headers, ...output].map((row) => row.map(escapeCsv).join(',')).join('\n');
}

export interface InvitationExportRow {
  household: Household;
  rsvpUrl: string;
  qrCodeDataUrl: string;
}

export function invitationExportToCsv(rows: InvitationExportRow[]): string {
  const headers = [
    'householdId',
    'household',
    'email',
    'phone',
    'addressLine1',
    'addressLine2',
    'city',
    'state',
    'postalCode',
    'country',
    'inviteLifecycleStatus',
    'inviteGeneratedAt',
    'inviteExportedAt',
    'inviteSentAt',
    'rsvpUrl',
    'qrCodeDataUrl',
  ];

  const output = rows.map(({ household, rsvpUrl, qrCodeDataUrl }) => [
    household.householdId,
    household.displayName,
    household.email ?? '',
    household.phone ?? '',
    household.mailingAddress?.line1 ?? '',
    household.mailingAddress?.line2 ?? '',
    household.mailingAddress?.city ?? '',
    household.mailingAddress?.state ?? '',
    household.mailingAddress?.postalCode ?? '',
    household.mailingAddress?.country ?? '',
    household.inviteLifecycleStatus,
    household.inviteCodeGeneratedAt ?? '',
    household.inviteExportedAt ?? '',
    household.inviteSentAt ?? '',
    rsvpUrl,
    qrCodeDataUrl,
  ]);

  return [headers, ...output].map((row) => row.map(escapeCsv).join(',')).join('\n');
}

function toRows(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(value);
      value = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        index += 1;
      }
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
    } else {
      value += char;
    }
  }

  row.push(value);
  rows.push(row);
  return rows;
}

function escapeCsv(value: unknown): string {
  const normalized = String(value ?? '');
  return /[",\n\r]/.test(normalized) ? `"${normalized.replaceAll('"', '""')}"` : normalized;
}
