import { describe, expect, it } from 'vitest';
import {
  CalendarEventSchema,
  BulkInvitationEmailResponseSchema,
  CreateHouseholdInputSchema,
  HotelBlockSchema,
  InvitationDetailsSchema,
  RsvpUpdateSchema,
  SendInvitationEmailResponseSchema,
  SendHouseholdNotificationInputSchema,
  UpdateHouseholdInputSchema,
  generateIcs,
} from './index.js';

describe('RsvpUpdateSchema', () => {
  it('requires attending guests to have an active meal status', () => {
    const result = RsvpUpdateSchema.safeParse({
      members: [{ memberId: 'm1', attending: true, mealChoice: 'none' }],
      plusOnes: [],
    });

    expect(result.success).toBe(false);
  });

  it('allows declined guests with no meal', () => {
    const result = RsvpUpdateSchema.safeParse({
      members: [{ memberId: 'm1', attending: false, mealChoice: 'none' }],
      plusOnes: [],
    });

    expect(result.success).toBe(true);
  });

  it('rejects plus-ones without a meal choice', () => {
    const result = RsvpUpdateSchema.safeParse({
      members: [{ memberId: 'm1', attending: true, mealChoice: 'buffet' }],
      plusOnes: [
        {
          sponsorMemberId: 'm1',
          firstName: 'Guest',
          lastName: 'Person',
          mealChoice: 'none',
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('accepts buffet-style attending responses', () => {
    const result = RsvpUpdateSchema.safeParse({
      members: [{ memberId: 'm1', attending: true, mealChoice: 'buffet' }],
      plusOnes: [
        {
          sponsorMemberId: 'm1',
          firstName: 'Guest',
          lastName: 'Person',
          mealChoice: 'buffet',
        },
      ],
    });

    expect(result.success).toBe(true);
  });
});

describe('CreateHouseholdInputSchema', () => {
  it('accepts a valid household payload', () => {
    const result = CreateHouseholdInputSchema.safeParse({
      displayName: 'Jordan and Casey',
      email: 'jordan@example.com',
      phone: '(480) 555-0100',
      mailingAddress: {
        line1: '123 Main St',
        city: 'Phoenix',
        state: 'AZ',
        postalCode: '85001',
        country: 'USA',
      },
      maxPlusOnes: 1,
      members: [
        {
          firstName: 'Jordan',
          lastName: 'Example',
          canBringPlusOne: true,
          weddingPartyRole: 'Best person',
          rehearsalDinnerInvited: true,
        },
      ],
    });

    expect(result.success).toBe(true);
  });
});

describe('UpdateHouseholdInputSchema', () => {
  it('validates editable household and mailing fields', () => {
    const result = UpdateHouseholdInputSchema.safeParse({
      displayName: 'The Updated Household',
      email: '',
      phone: '+14805550100',
      maxPlusOnes: 2,
      mailingAddress: {
        line1: '456 Oak Ave',
        line2: '',
        city: 'Scottsdale',
        state: 'AZ',
        postalCode: '85251',
        country: 'USA',
      },
    });

    expect(result.success).toBe(true);
  });
});

describe('SendHouseholdNotificationInputSchema', () => {
  it('accepts email notifications with a subject', () => {
    const result = SendHouseholdNotificationInputSchema.safeParse({
      channel: 'email',
      subject: 'Wedding update',
      message: 'The shuttle will leave at 4:15 PM.',
    });

    expect(result.success).toBe(true);
  });

  it('accepts SMS notifications without a subject', () => {
    const result = SendHouseholdNotificationInputSchema.safeParse({
      channel: 'sms',
      message: 'Ceremony starts at 3:00 PM. Safe travels.',
    });

    expect(result.success).toBe(true);
  });
});

describe('invitation admin schemas', () => {
  it('validates revealed invitation details and email send results', () => {
    const invitation = InvitationDetailsSchema.safeParse({
      householdId: 'h1',
      inviteCode: 'invite-code-123',
      inviteCodeHash: 'hash',
      rsvpUrl: 'https://wedding.example.com/rsvp/invite-code-123',
    });

    expect(invitation.success).toBe(true);

    expect(
      SendInvitationEmailResponseSchema.safeParse({
        invitation: invitation.success ? invitation.data : undefined,
        result: {
          householdId: 'h1',
          displayName: 'The Example Household',
          status: 'sent',
          deliveredTo: 'guest@example.com',
          message: 'Sent invitation email to guest@example.com',
        },
      }).success,
    ).toBe(true);

    expect(
      BulkInvitationEmailResponseSchema.safeParse({
        results: [
          {
            householdId: 'h1',
            displayName: 'The Example Household',
            status: 'skipped',
            message: 'Household does not have a contact email address',
          },
        ],
      }).success,
    ).toBe(true);
  });
});

describe('structured public planning data', () => {
  it('validates hotel block data', () => {
    const result = HotelBlockSchema.safeParse({
      name: 'Example Hotel',
      address: '123 Resort Way, Scottsdale, AZ',
      bookingUrl: 'https://hotel.example.com/wedding',
      phoneNumber: '555-0100',
      groupCode: 'MATTALISON',
      cutoffDate: 'January 15, 2027',
      nightlyRateNotes: 'Wedding block rate available while rooms last.',
      transportationNotes: 'Shuttle details will be posted closer to the wedding.',
    });

    expect(result.success).toBe(true);
  });

  it('generates a deterministic ICS event body', () => {
    const event = CalendarEventSchema.parse({
      title: 'Matt and Alison Wedding',
      start: '2027-03-20T22:00:00.000Z',
      end: '2027-03-21T04:00:00.000Z',
      timezone: 'America/Phoenix',
      location: 'Desert Garden Venue, Scottsdale, AZ',
      description: 'Ceremony and reception for Matt and Alison.',
    });

    const ics = generateIcs(event);

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('SUMMARY:Matt and Alison Wedding');
    expect(ics).toContain('DTSTART;TZID=America/Phoenix:20270320T220000');
    expect(ics).toContain('LOCATION:Desert Garden Venue\\, Scottsdale\\, AZ');
  });
});
