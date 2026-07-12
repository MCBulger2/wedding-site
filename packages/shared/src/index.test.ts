/// <reference types="node" />

import { describe, expect, it, vi } from 'vitest';
import {
  CalendarEventSchema,
  BulkInvitationEmailResponseSchema,
  CreateHouseholdInputSchema,
  GenericRecoverySuccessMessage,
  HotelBlockSchema,
  HouseholdSchema,
  InvitationDetailsSchema,
  PublicSmsSubscriptionRequestSchema,
  PublicSmsSubscriptionResponseSchema,
  SMS_CONSENT_TEXT_VERSION,
  RsvpRecoveryAcceptedResponseSchema,
  RsvpRecoveryRequestSchema,
  SmsPreferencesRequestSchema,
  RsvpUpdateSchema,
  SendInvitationEmailResponseSchema,
  SendHouseholdNotificationInputSchema,
  SmsConsentSourceSchema,
  UpdateHouseholdInputSchema,
  generateIcs,
  siteContent,
} from './index.js';

describe('Public SMS subscription schemas', () => {
  it('accepts a phone number with confirmed consent', () => {
    expect(
      PublicSmsSubscriptionRequestSchema.safeParse({
        phone: '(480) 555-0100',
        consentAccepted: true,
      }).success,
    ).toBe(true);
  });

  it.each([
    { phone: '(480) 555-0100', consentAccepted: false },
    { phone: '(480) 555-0100' },
  ])('rejects missing or unconfirmed consent', (request) => {
    expect(PublicSmsSubscriptionRequestSchema.safeParse(request).success).toBe(
      false,
    );
  });

  it('rejects unsupported phone characters', () => {
    expect(
      PublicSmsSubscriptionRequestSchema.safeParse({
        phone: '480-555-0100 ext 2',
        consentAccepted: true,
      }).success,
    ).toBe(false);
  });

  it('accepts an opted-in response', () => {
    expect(
      PublicSmsSubscriptionResponseSchema.safeParse({ status: 'opted_in' })
        .success,
    ).toBe(true);
  });

  it('supports the public SMS opt-in consent source', () => {
    expect(SmsConsentSourceSchema.parse('public_sms_opt_in')).toBe(
      'public_sms_opt_in',
    );
  });
});

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

  it('removes SMS preference fields from RSVP payloads', () => {
    const result = RsvpUpdateSchema.safeParse({
      members: [{ memberId: 'm1', attending: true, mealChoice: 'buffet' }],
      plusOnes: [],
      smsPhone: '(480) 555-0100',
      smsConsentAccepted: true,
    });

    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty('smsPhone');
    expect(result.data).not.toHaveProperty('smsConsentAccepted');
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

describe('RsvpRecovery schemas', () => {
  it('accepts a recovery request contact and generic accepted response', () => {
    expect(
      RsvpRecoveryRequestSchema.safeParse({
        contact: 'sam@example.com',
      }).success,
    ).toBe(true);

    expect(
      RsvpRecoveryAcceptedResponseSchema.safeParse({
        accepted: true,
        message: GenericRecoverySuccessMessage,
      }).success,
    ).toBe(true);
  });

  it('accepts phone recovery without enrollment fields', () => {
    expect(
      RsvpRecoveryRequestSchema.safeParse({
        contact: '(480) 555-0100',
        smsConsentAccepted: true,
      }).success,
    ).toBe(true);
    expect(
      RsvpRecoveryRequestSchema.parse({
        contact: '(480) 555-0100',
        smsConsentAccepted: true,
      }),
    ).toEqual({ contact: '(480) 555-0100' });
  });
});

describe('SmsPreferencesRequestSchema', () => {
  it('requires a phone only when enabling SMS', () => {
    expect(
      SmsPreferencesRequestSchema.safeParse({
        enabled: true,
        phone: '(480) 555-0100',
      }).success,
    ).toBe(true);
    expect(SmsPreferencesRequestSchema.safeParse({ enabled: true }).success).toBe(false);
    expect(SmsPreferencesRequestSchema.safeParse({ enabled: false }).success).toBe(true);
  });
});

describe('SMS consent schema', () => {
  it('validates stored SMS consent metadata', () => {
    const result = HouseholdSchema.safeParse({
      householdId: 'h1',
      displayName: 'The Example Household',
      email: 'sam@example.com',
      phone: '+14805550100',
      smsConsent: {
        status: 'opted_in',
        phone: '+14805550100',
        source: 'rsvp_form',
        consentedAt: '2026-07-03T20:00:00.000Z',
        consentTextVersion: SMS_CONSENT_TEXT_VERSION,
      },
      members: [
        {
          id: 'm1',
          firstName: 'Sam',
          lastName: 'Example',
        },
      ],
      maxPlusOnes: 0,
      rsvpStatus: 'not_started',
      inviteLifecycleStatus: 'generated',
      createdAt: '2026-07-03T20:00:00.000Z',
      updatedAt: '2026-07-03T20:00:00.000Z',
    });

    expect(result.success).toBe(true);
  });

  it.each(['pending_confirmation', 'opted_out'] as const)(
    'accepts %s SMS preference state',
    (status) => {
      const result = HouseholdSchema.shape.smsConsent.safeParse({
        status,
        phone: '+14805550100',
        source: 'sms_preferences',
        consentedAt: '2026-07-03T20:00:00.000Z',
        consentTextVersion: SMS_CONSENT_TEXT_VERSION,
      });

      expect(result.success).toBe(true);
    },
  );
});

describe('invitation admin schemas', () => {
  it('validates revealed invitation details and email send results', () => {
    const invitation = InvitationDetailsSchema.safeParse({
      householdId: 'h1',
      inviteCode: 'A2B3C4D5E6',
      inviteCodeHash: 'hash',
      rsvpUrl: 'https://wedding.example.com/rsvp/A2B3C4D5E6',
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
  it('publishes the public contact email address', () => {
    expect(siteContent.contact).toEqual({
      email: 'contact@matt-alison.com',
      href: 'mailto:contact@matt-alison.com',
    });
  });

  it('can publish the public contact email address from environment', async () => {
    const originalContactEmailAddress = process.env.CONTACT_EMAIL_ADDRESS;

    try {
      vi.resetModules();
      process.env.CONTACT_EMAIL_ADDRESS = 'questions@example.com';
      const { siteContent: envSiteContent } = await import('./siteContent.js');

      expect(envSiteContent.contact).toEqual({
        email: 'questions@example.com',
        href: 'mailto:questions@example.com',
      });
    } finally {
      if (originalContactEmailAddress === undefined) {
        delete process.env.CONTACT_EMAIL_ADDRESS;
      } else {
        process.env.CONTACT_EMAIL_ADDRESS = originalContactEmailAddress;
      }
      vi.resetModules();
    }
  });

  it('uses a parseable OpenStreetMap embed URL with a venue marker', () => {
    const embedUrl = new URL(siteContent.venueMapEmbedUrl);

    expect(siteContent.venueMapEmbedUrl).not.toContain('&amp;');
    expect(embedUrl.hostname).toBe('www.openstreetmap.org');
    expect(embedUrl.searchParams.get('layer')).toBe('mapnik');
    expect(embedUrl.searchParams.get('marker')).toBe('33.4374400,-111.5989000');
  });

  it('validates hotel block data', () => {
    const result = HotelBlockSchema.safeParse({
      name: 'Example Hotel',
      address: '123 Resort Way, Scottsdale, AZ',
      bookingUrl: 'https://hotel.example.com/wedding',
      phoneNumber: '555-0100',
      groupCode: 'MATTALISON',
      cutoffDate: 'January 15, 2027',
      nightlyRateNotes: 'Wedding block rate available while rooms last.',
      transportationNotes:
        'Shuttle details will be posted closer to the wedding.',
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
