import { describe, expect, it } from 'vitest';
import type { Household } from '@matt-alison-wedding/shared';
import { hashInviteCode } from './inviteCodes.js';
import { InMemoryWeddingRepository } from './repository.js';
import { PublicError, WeddingService } from './service.js';
import {
  buildRsvpNotificationEmail,
  type HouseholdMessenger,
  type RsvpNotifier,
} from './notifications.js';

const pepper = 'unit-test-pepper';
const inviteCode = 'test-invite-code-123';

describe('WeddingService', () => {
  it('looks up RSVP households by hashed invite code only', async () => {
    const { service } = await createSeededService();

    const result = await service.getRsvp(inviteCode);

    expect(result.household.displayName).toBe('The Example Household');
  });

  it('returns a generic error for invalid invite codes', async () => {
    const { service } = await createSeededService();

    await expect(service.getRsvp('wrong-invite-code')).rejects.toMatchObject({
      message: 'We could not find that RSVP. Please check your invitation link.',
      statusCode: 404,
    });
  });

  it('rejects RSVP submissions with unauthorized plus-ones', async () => {
    const { service } = await createSeededService({ maxPlusOnes: 0 });

    await expect(
      service.updateRsvp(inviteCode, {
        members: [
          { memberId: 'h1-1', attending: true, mealChoice: 'chicken' },
          { memberId: 'h1-2', attending: true, mealChoice: 'vegetarian' },
        ],
        plusOnes: [
          {
            sponsorMemberId: 'h1-1',
            firstName: 'Guest',
            lastName: 'Person',
            mealChoice: 'fish',
          },
        ],
      }),
    ).rejects.toBeInstanceOf(PublicError);
  });

  it('stores valid RSVP updates with timestamps', async () => {
    const { service, repository } = await createSeededService();

    const result = await service.updateRsvp(inviteCode, {
      members: [
        { memberId: 'h1-1', attending: true, mealChoice: 'chicken' },
        { memberId: 'h1-2', attending: false, mealChoice: 'none' },
      ],
      plusOnes: [],
      notes: 'Looking forward to it',
    });

    const stored = repository.rsvps.get('h1');
    expect(stored?.members).toHaveLength(2);
    expect(stored?.submittedAt).toBeTruthy();
    expect(result.household.rsvpStatus).toBe('partial');
    expect((await repository.getHousehold('h1'))?.rsvpStatus).toBe('partial');
  });

  it('notifies admins after RSVP updates are persisted', async () => {
    const notifier = new RecordingNotifier();
    const { service, repository } = await createSeededService({}, notifier);

    await service.updateRsvp(inviteCode, {
      members: [
        { memberId: 'h1-1', attending: true, mealChoice: 'chicken' },
        { memberId: 'h1-2', attending: false, mealChoice: 'none' },
      ],
      plusOnes: [],
      notes: '',
      accessibilityNotes: '',
    });

    expect(repository.rsvps.get('h1')).toBeTruthy();
    expect(notifier.calls).toHaveLength(1);
    expect(notifier.calls[0].household.displayName).toBe('The Example Household');
  });

  it('keeps guest RSVP saves successful when notification delivery fails', async () => {
    const notifier = new RecordingNotifier(new Error('SES unavailable'));
    const { service, repository } = await createSeededService({}, notifier);

    await expect(
      service.updateRsvp(inviteCode, {
        members: [
          { memberId: 'h1-1', attending: true, mealChoice: 'fish' },
          { memberId: 'h1-2', attending: true, mealChoice: 'vegetarian' },
        ],
        plusOnes: [],
        notes: '',
        accessibilityNotes: '',
      }),
    ).resolves.toHaveProperty('rsvp');

    expect(repository.rsvps.get('h1')?.members[0].mealChoice).toBe('fish');
    expect(notifier.calls).toHaveLength(1);
  });

  it('creates households for admin management', async () => {
    const repository = new InMemoryWeddingRepository();
    const service = new WeddingService(repository, pepper);

    const household = await service.createHousehold({
      displayName: 'Jordan and Casey',
      email: 'jordan@example.com',
      phone: '(480) 555-0100',
      maxPlusOnes: 1,
      members: [
        { firstName: 'Jordan', lastName: 'Example', canBringPlusOne: true },
        { firstName: 'Casey', lastName: 'Example', canBringPlusOne: false },
      ],
    });

    expect(household.householdId).toBeTruthy();
    expect(household.members[0].id).toContain(household.householdId);
    expect(household.phone).toBe('+14805550100');
    expect((await repository.getHousehold(household.householdId))?.displayName).toBe('Jordan and Casey');
  });

  it('normalizes household phone numbers when admins edit them', async () => {
    const { service, repository } = await createSeededService();

    await service.updateHousehold('h1', {
      displayName: 'The Example Household',
      email: 'sam@example.com',
      phone: '1 (480) 555-0111',
      maxPlusOnes: 1,
      mailingAddress: {
        line1: '123 Main St',
        city: 'Phoenix',
        state: 'AZ',
        postalCode: '85001',
        country: 'USA',
      },
    });

    expect((await repository.getHousehold('h1'))?.phone).toBe('+14805550111');
  });

  it('lists admin households with RSVP attendance details', async () => {
    const { service } = await createSeededService();

    await service.updateRsvp(inviteCode, {
      members: [
        { memberId: 'h1-1', attending: true, mealChoice: 'fish' },
        { memberId: 'h1-2', attending: false, mealChoice: 'none' },
      ],
      plusOnes: [],
      notes: '',
      accessibilityNotes: '',
    });

    const result = await service.listHouseholds();

    expect(result).toHaveLength(1);
    expect(result[0].attendance.attendingGuests).toBe(1);
    expect(result[0].rsvp?.members[0].mealChoice).toBe('fish');
  });

  it('rejects plus-ones when the sponsor is not attending', async () => {
    const { service } = await createSeededService();

    await expect(
      service.updateRsvp(inviteCode, {
        members: [
          { memberId: 'h1-1', attending: false, mealChoice: 'none' },
          { memberId: 'h1-2', attending: true, mealChoice: 'vegetarian' },
        ],
        plusOnes: [
          {
            sponsorMemberId: 'h1-1',
            firstName: 'Guest',
            lastName: 'Person',
            mealChoice: 'fish',
          },
        ],
        notes: '',
        accessibilityNotes: '',
      }),
    ).rejects.toMatchObject({
      message: 'A plus-one sponsor must be attending',
      statusCode: 422,
    });
  });

  it('rotates invite codes without overwriting an existing RSVP', async () => {
    const { service, repository } = await createSeededService();

    await service.updateRsvp(inviteCode, {
      members: [
        { memberId: 'h1-1', attending: true, mealChoice: 'chicken' },
        { memberId: 'h1-2', attending: true, mealChoice: 'vegetarian' },
      ],
      plusOnes: [],
      notes: 'See you there',
      accessibilityNotes: '',
    });

    await service.rotateInviteCode('h1');

    expect(repository.rsvps.get('h1')?.notes).toBe('See you there');
    expect((await repository.getHousehold('h1'))?.inviteCodeLastRotatedAt).toBeTruthy();
  });

  it('requires confirmation before rotating an exported invite and blocks sent invite rotation', async () => {
    const { service } = await createSeededService({ inviteLifecycleStatus: 'exported' });

    await expect(service.rotateInviteCode('h1')).rejects.toMatchObject({
      message: 'Rotating an exported invite requires explicit confirmation',
      statusCode: 409,
    });

    await expect(service.rotateInviteCode('h1', { confirmRotation: true })).resolves.toHaveProperty('inviteCode');
    await service.updateInviteLifecycle('h1', { status: 'exported' });
    await service.updateInviteLifecycle('h1', { status: 'sent' });

    await expect(service.rotateInviteCode('h1', { confirmRotation: true })).rejects.toMatchObject({
      message: 'Sent invitations cannot be rotated. Archive the household or contact guests directly.',
      statusCode: 409,
    });
  });

  it('invalidates the old invite code after rotation', async () => {
    const { service } = await createSeededService();

    await service.rotateInviteCode('h1');

    await expect(service.getRsvp(inviteCode)).rejects.toMatchObject({
      message: 'We could not find that RSVP. Please check your invitation link.',
      statusCode: 404,
    });
  });

  it('updates household and person details without changing member IDs', async () => {
    const { service, repository } = await createSeededService();

    await service.updateHousehold('h1', {
      displayName: 'The Renamed Household',
      email: 'updated@example.com',
      maxPlusOnes: 2,
      mailingAddress: {
        line1: '123 Main St',
        city: 'Phoenix',
        state: 'AZ',
        postalCode: '85001',
        country: 'USA',
      },
    });
    await service.updateHouseholdMember('h1', 'h1-1', {
      firstName: 'Samuel',
      lastName: 'Example',
      canBringPlusOne: false,
      weddingPartyRole: 'Officiant',
      rehearsalDinnerInvited: true,
    });

    const stored = await repository.getHousehold('h1');
    expect(stored?.displayName).toBe('The Renamed Household');
    expect(stored?.members[0]).toMatchObject({
      id: 'h1-1',
      firstName: 'Samuel',
      weddingPartyRole: 'Officiant',
      rehearsalDinnerInvited: true,
    });
  });

  it('archives members with RSVP history and blocks archived households from guest lookup', async () => {
    const { service, repository } = await createSeededService();

    await service.updateRsvp(inviteCode, {
      members: [
        { memberId: 'h1-1', attending: true, mealChoice: 'chicken' },
        { memberId: 'h1-2', attending: false, mealChoice: 'none' },
      ],
      plusOnes: [],
      notes: '',
      accessibilityNotes: '',
    });

    await service.removeHouseholdMember('h1', 'h1-1');
    expect((await repository.getHousehold('h1'))?.members[0].archivedAt).toBeTruthy();

    await service.archiveHousehold('h1');
    await expect(service.archiveHousehold('h1')).rejects.toMatchObject({
      message: 'Household is already archived',
      statusCode: 409,
    });
    await expect(service.getRsvp(inviteCode)).rejects.toMatchObject({
      message: 'We could not find that RSVP. Please check your invitation link.',
    });
  });

  it('exports invitation mailing rows with RSVP URLs and QR code data URLs', async () => {
    const { service, repository } = await createSeededService({
      inviteLifecycleStatus: 'not_generated',
      inviteCodeHash: undefined,
      mailingAddress: {
        line1: '123 Main St',
        line2: '',
        city: 'Phoenix',
        state: 'AZ',
        postalCode: '85001',
        country: 'USA',
      },
    });

    const csv = await service.exportInvitations('https://wedding.example.com');

    expect(csv).toContain('householdId,household,email,phone,addressLine1');
    expect(csv).toContain('https://wedding.example.com/rsvp/');
    expect(csv).toContain('data:image/png;base64');
    expect((await repository.getHousehold('h1'))?.inviteLifecycleStatus).toBe('exported');
  });

  it('builds notification email content without invite-code secrets', async () => {
    const { service } = await createSeededService();
    const { household, rsvp } = await service.updateRsvp(inviteCode, {
      members: [
        { memberId: 'h1-1', attending: true, mealChoice: 'chicken' },
        { memberId: 'h1-2', attending: false, mealChoice: 'none' },
      ],
      plusOnes: [],
      notes: '',
      accessibilityNotes: '',
    });

    const email = buildRsvpNotificationEmail({ household, rsvp }, 'https://wedding.example.com/admin');

    expect(email.subject).toBe('RSVP updated: The Example Household');
    expect(email.text).toContain('Attending guests: 1');
    expect(email.text).toContain('Admin dashboard: https://wedding.example.com/admin');
    expect(email.text).not.toContain(inviteCode);
    expect(email.text).not.toContain(household.inviteCodeHash ?? '');
  });

  it('sends household email notifications to the saved contact email', async () => {
    const householdMessenger = new RecordingHouseholdMessenger();
    const { service } = await createSeededService({}, undefined, householdMessenger);

    const response = await service.sendHouseholdNotification('h1', {
      channel: 'email',
      subject: 'Wedding update',
      message: 'The shuttle leaves at 4:15 PM.',
    });

    expect(response).toEqual({
      channel: 'email',
      deliveredTo: 'sam@example.com',
    });
    expect(householdMessenger.calls).toHaveLength(1);
    expect(householdMessenger.calls[0]).toMatchObject({
      channel: 'email',
      household: { householdId: 'h1' },
      subject: 'Wedding update',
    });
  });

  it('sends household SMS notifications to the saved mobile number', async () => {
    const householdMessenger = new RecordingHouseholdMessenger();
    const { service } = await createSeededService(
      { phone: '+14805550100' },
      undefined,
      householdMessenger,
    );

    const response = await service.sendHouseholdNotification('h1', {
      channel: 'sms',
      message: 'Ceremony starts at 3:00 PM.',
    });

    expect(response).toEqual({
      channel: 'sms',
      deliveredTo: '+14805550100',
    });
    expect(householdMessenger.calls[0]).toMatchObject({
      channel: 'sms',
      household: { phone: '+14805550100' },
      message: 'Ceremony starts at 3:00 PM.',
    });
  });

  it('rejects household notifications when the requested contact channel is missing', async () => {
    const householdMessenger = new RecordingHouseholdMessenger();
    const { service } = await createSeededService({ email: undefined }, undefined, householdMessenger);

    await expect(
      service.sendHouseholdNotification('h1', {
        channel: 'email',
        subject: 'Wedding update',
        message: 'See you soon.',
      }),
    ).rejects.toMatchObject({
      message: 'This household does not have a contact email address',
      statusCode: 422,
    });

    expect(householdMessenger.calls).toHaveLength(0);
  });
});

class RecordingNotifier implements RsvpNotifier {
  readonly calls: Parameters<RsvpNotifier['notifyRsvpChanged']>[0][] = [];

  constructor(private readonly failure?: Error) {}

  async notifyRsvpChanged(input: Parameters<RsvpNotifier['notifyRsvpChanged']>[0]): Promise<void> {
    this.calls.push(input);
    if (this.failure) {
      throw this.failure;
    }
  }
}

class RecordingHouseholdMessenger implements HouseholdMessenger {
  readonly calls: Parameters<HouseholdMessenger['sendHouseholdNotification']>[0][] =
    [];

  constructor(private readonly failure?: Error) {}

  async sendHouseholdNotification(
    input: Parameters<HouseholdMessenger['sendHouseholdNotification']>[0],
  ) {
    this.calls.push(input);
    if (this.failure) {
      throw this.failure;
    }

    return {
      channel: input.channel,
      deliveredTo:
        input.channel === 'email'
          ? input.household.email ?? ''
          : input.household.phone ?? '',
    };
  }
}

async function createSeededService(
  overrides: Partial<Household> = {},
  notifier?: RsvpNotifier,
  householdMessenger?: HouseholdMessenger,
) {
  const repository = new InMemoryWeddingRepository();
  const inviteCodeHash = hashInviteCode(inviteCode, pepper);
  const household: Household = {
    householdId: 'h1',
    displayName: 'The Example Household',
    email: 'sam@example.com',
    members: [
      { id: 'h1-1', firstName: 'Sam', lastName: 'Example', canBringPlusOne: true },
      { id: 'h1-2', firstName: 'Taylor', lastName: 'Example', canBringPlusOne: false },
    ],
    maxPlusOnes: 1,
    rsvpStatus: 'not_started',
    inviteCodeGeneratedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
    inviteLifecycleStatus: overrides.inviteLifecycleStatus ?? 'generated',
    inviteCodeHash: Object.hasOwn(overrides, 'inviteCodeHash') ? overrides.inviteCodeHash : inviteCodeHash,
  };

  await repository.saveHousehold(household);
  await repository.saveInviteCodeLookup({
    householdId: household.householdId,
    inviteCodeHash,
    createdAt: new Date().toISOString(),
  });

  return {
    repository,
    service: new WeddingService(repository, pepper, notifier, householdMessenger),
  };
}
