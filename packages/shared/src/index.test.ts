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
  RsvpSearchRequestSchema,
  RsvpSearchResponseSchema,
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
  it('preserves an optional rehearsal dinner response for legacy RSVPs', () => {
    const result = RsvpUpdateSchema.safeParse({
      members: [
        {
          memberId: 'm1',
          attending: true,
          mealChoice: 'buffet',
          rehearsalDinnerAttending: true,
        },
      ],
      plusOnes: [],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.members[0].rehearsalDinnerAttending).toBe(true);
    }
  });

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

describe('RsvpSearch schemas', () => {
  it('trims search names and accepts valid HTTPS RSVP URLs in results', () => {
    expect(RsvpSearchRequestSchema.parse({ lastName: '  Example  ' })).toEqual({
      lastName: 'Example',
    });

    expect(
      RsvpSearchResponseSchema.parse({
        results: [
          {
            displayName: 'The Example Household',
            rsvpUrl: 'https://matt-alison.com/rsvp/A2B3C4D5E6',
          },
        ],
        tooManyMatches: false,
      }),
    ).toEqual({
      results: [
        {
          displayName: 'The Example Household',
          rsvpUrl: 'https://matt-alison.com/rsvp/A2B3C4D5E6',
        },
      ],
      tooManyMatches: false,
    });
  });

  it.each([{ lastName: ' ' }, { lastName: 'a'.repeat(81) }])(
    'rejects blank or overlong last names',
    (request) => {
      expect(RsvpSearchRequestSchema.safeParse(request).success).toBe(false);
    },
  );

  it('rejects extra fields in search results', () => {
    expect(
      RsvpSearchResponseSchema.safeParse({
        results: [
          {
            displayName: 'The Example Household',
            rsvpUrl: 'https://matt-alison.com/rsvp/A2B3C4D5E6',
            householdId: 'h1',
          },
        ],
        tooManyMatches: false,
      }).success,
    ).toBe(false);
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
    expect(
      SmsPreferencesRequestSchema.safeParse({ enabled: true }).success,
    ).toBe(false);
    expect(
      SmsPreferencesRequestSchema.safeParse({ enabled: false }).success,
    ).toBe(true);
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

  it('uses a parseable OpenStreetMap embed URL with the native venue marker', () => {
    const embedUrl = new URL(siteContent.venueMapEmbedUrl);

    expect(siteContent.venueMapEmbedUrl).not.toContain('&amp;');
    expect(embedUrl.hostname).toBe('www.openstreetmap.org');
    expect(embedUrl.searchParams.get('layer')).toBe('mapnik');
    expect(embedUrl.searchParams.get('marker')).toBe('33.4374400,-111.5989000');
  });

  it('publishes the approved story chapters and personal photography', () => {
    expect(siteContent.ourStory.intro).toBe(
      "From meeting in a programming class at ASU to making a home together in Phoenix, we've shared plenty of adventures along the way. Here's a little about the story that brought us here.",
    );
    expect(siteContent.ourStory.heroImage.src).toBe('/close-up.jpg');
    expect(siteContent.ourStory.chapters.map((chapter) => chapter.id)).toEqual([
      'asu',
      'life-together',
      'proposal',
      'always-side-by-side',
    ]);
    expect(
      siteContent.ourStory.chapters.map(({ id, paragraphs }) => ({
        id,
        paragraphs,
      })),
    ).toEqual([
      {
        id: 'asu',
        paragraphs: [
          'We met in 2019 during freshman year at Arizona State University—luckily for both of us, we ended up in the same programming class.',
          "We got to know each other through several more classes and stayed in touch even after the COVID-19 pandemic sent Matt away from the dorms. Once he returned, it wasn't long before we were dating, and the rest is history.",
          "We both graduated from ASU in 2023: Alison with an MS in Actuarial Science and Matt with a BS in Computer Science. Since then, we've made our home together in the Phoenix and Scottsdale area.",
        ],
      },
      {
        id: 'life-together',
        paragraphs: [
          "We spend many race weekends watching Formula 1 (and cheering for Max Verstappen!). Attending the 2025 Canadian Grand Prix was an experience we'll never forget.",
          'We also love cooking together, building LEGO sets, and working on puzzles. In fact, our dining room table is much better known as the designated puzzle table.',
        ],
      },
      {
        id: 'proposal',
        paragraphs: [
          'During Easter weekend 2026, we traveled to Denver. We spent a lovely day sightseeing, including buying some LEGO, of course. Later, at City Park, Matt asked Alison to marry him.',
          "Matt's parents, Jane and Tom, and his brothers, Tim and Joe, were there to share the moment with us. Tim graciously captured it all in the proposal photos you see here.",
        ],
      },
      {
        id: 'always-side-by-side',
        paragraphs: [
          "We're excited to take this big next step in our lives and celebrate it with the people we love. Whatever comes next, we know we'll always be by each other's side.",
        ],
      },
    ]);
    expect(siteContent.ourStory.chapters[0]).toMatchObject({
      title: 'It started at ASU',
      images: [
        { src: '/asu-graduation.jpg', caption: 'ASU graduation day' },
        { src: '/asu-spin.JPEG', caption: 'A spin around ASU' },
        { src: '/asu.JPEG', caption: 'Back at ASU' },
        { src: '/asu-hockey.JPEG', caption: 'ASU hockey night' },
      ],
    });
    expect(siteContent.ourStory.chapters[1]).toMatchObject({
      title: 'Life together',
      images: [
        {
          src: '/canadian-grand-prix.jpg',
          caption: 'At the Canadian Grand Prix',
        },
        { src: '/drs.JPEG', caption: 'DRS' },
        {
          src: '/canada-ferris-wheel.JPEG',
          caption: 'Montreal by the water',
        },
        { src: '/canada-alison-flowers.JPEG', caption: 'A little color' },
        { src: '/san-diego.JPEG', caption: 'By the Pacific' },
        { src: '/vegas-bellagio.JPEG', caption: 'A weekend in Las Vegas' },
        { src: '/niagara-falls.JPEG', caption: 'Niagara Falls' },
      ],
    });
    expect(siteContent.ourStory.chapters[2]).toMatchObject({
      title: 'The proposal',
      images: [{ src: '/hero-wedding.jpg' }, { src: '/smile.jpg' }],
    });
    expect(siteContent.ourStory.chapters[3]).toMatchObject({
      title: 'Always side by side',
      images: [{ src: '/engagement-08.jpg' }],
    });
  });

  it('publishes grouped Phoenix favorites with paired map URLs', () => {
    const groups = siteContent.ourStory.phoenixGuide.groups;
    expect(groups.map((group) => group.id)).toEqual([
      'build',
      'eat',
      'explore',
    ]);

    const recommendations = groups.flatMap((group) => group.recommendations);
    const legoTour = recommendations.find((item) => item.id === 'lego-tour');
    expect(
      legoTour?.destinations.map((destination) => destination.label),
    ).toEqual([
      'LEGO Store Scottsdale Quarter',
      'LEGO Store Chandler Fashion Center',
      'LEGO Store Arrowhead Towne Center',
    ]);
    expect(recommendations.map((item) => item.id)).toEqual([
      'lego-tour',
      'oreganos',
      'buck-and-rider',
      'bei-sushi',
      'desert-botanical-garden',
      'papago-park',
      'mcdowell-sonoran-preserve',
      'piestewa-peak',
      'odysea-aquarium',
    ]);
    expect(
      recommendations.flatMap((recommendation) =>
        recommendation.destinations.map((destination) => ({
          recommendationId: recommendation.id,
          label: destination.label,
          address: destination.address,
          googleQuery: new URL(destination.googleMapsUrl).searchParams.get(
            'query',
          ),
          appleQuery: new URL(destination.appleMapsUrl).searchParams.get('q'),
        })),
      ),
    ).toEqual([
      {
        recommendationId: 'lego-tour',
        label: 'LEGO Store Scottsdale Quarter',
        address: '15257 N Scottsdale Road, Suite 170, Scottsdale, AZ 85254',
        googleQuery:
          'LEGO Store Scottsdale Quarter 15257 N Scottsdale Road Suite 170 Scottsdale AZ 85254',
        appleQuery:
          'LEGO Store Scottsdale Quarter 15257 N Scottsdale Road Suite 170 Scottsdale AZ 85254',
      },
      {
        recommendationId: 'lego-tour',
        label: 'LEGO Store Chandler Fashion Center',
        address: '3111 W Chandler Boulevard, Chandler, AZ 85226',
        googleQuery:
          'LEGO Store Chandler Fashion Center 3111 W Chandler Boulevard Chandler AZ 85226',
        appleQuery:
          'LEGO Store Chandler Fashion Center 3111 W Chandler Boulevard Chandler AZ 85226',
      },
      {
        recommendationId: 'lego-tour',
        label: 'LEGO Store Arrowhead Towne Center',
        address: '7700 W Arrowhead Towne Center, Glendale, AZ 85308',
        googleQuery:
          'LEGO Store Arrowhead Towne Center 7700 W Arrowhead Towne Center Glendale AZ 85308',
        appleQuery:
          'LEGO Store Arrowhead Towne Center 7700 W Arrowhead Towne Center Glendale AZ 85308',
      },
      {
        recommendationId: 'oreganos',
        label: "Oregano's",
        address: undefined,
        googleQuery: "Oregano's Phoenix Arizona",
        appleQuery: "Oregano's Phoenix Arizona",
      },
      {
        recommendationId: 'buck-and-rider',
        label: 'Buck & Rider',
        address: undefined,
        googleQuery: 'Buck & Rider Phoenix Arizona',
        appleQuery: 'Buck & Rider Phoenix Arizona',
      },
      {
        recommendationId: 'bei-sushi',
        label: 'Bei Sushi',
        address: undefined,
        googleQuery: 'Bei Sushi Phoenix Arizona',
        appleQuery: 'Bei Sushi Phoenix Arizona',
      },
      {
        recommendationId: 'desert-botanical-garden',
        label: 'Desert Botanical Garden',
        address: '1201 N Galvin Parkway, Phoenix, AZ 85008',
        googleQuery:
          'Desert Botanical Garden 1201 N Galvin Parkway Phoenix AZ 85008',
        appleQuery:
          'Desert Botanical Garden 1201 N Galvin Parkway Phoenix AZ 85008',
      },
      {
        recommendationId: 'papago-park',
        label: 'Papago Park',
        address: undefined,
        googleQuery: 'Papago Park Phoenix Arizona',
        appleQuery: 'Papago Park Phoenix Arizona',
      },
      {
        recommendationId: 'mcdowell-sonoran-preserve',
        label: 'McDowell Sonoran Preserve',
        address: '18333 N Thompson Peak Parkway, Scottsdale, AZ 85255',
        googleQuery:
          'Gateway Trailhead 18333 N Thompson Peak Parkway Scottsdale AZ 85255',
        appleQuery:
          'Gateway Trailhead 18333 N Thompson Peak Parkway Scottsdale AZ 85255',
      },
      {
        recommendationId: 'piestewa-peak',
        label: 'Piestewa Peak',
        address: undefined,
        googleQuery: 'Piestewa Peak Phoenix Arizona',
        appleQuery: 'Piestewa Peak Phoenix Arizona',
      },
      {
        recommendationId: 'odysea-aquarium',
        label: 'OdySea Aquarium',
        address: '9500 E Via de Ventura, Suite A-100, Scottsdale, AZ 85256',
        googleQuery:
          'OdySea Aquarium 9500 E Via de Ventura Suite A-100 Scottsdale AZ 85256',
        appleQuery:
          'OdySea Aquarium 9500 E Via de Ventura Suite A-100 Scottsdale AZ 85256',
      },
    ]);
    expect(
      recommendations
        .flatMap((item) => item.destinations)
        .every(
          (destination) =>
            new URL(destination.googleMapsUrl).hostname === 'www.google.com' &&
            new URL(destination.appleMapsUrl).hostname === 'maps.apple.com',
        ),
    ).toBe(true);
    expect(siteContent.ourStory.phoenixGuide.hikingNote).toMatch(
      /Bring water and check current trail conditions/,
    );
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
    expect(ics).toContain('DTSTART;TZID=America/Phoenix:20270320T150000');
    expect(ics).toContain('DTEND;TZID=America/Phoenix:20270320T210000');
    expect(ics).toContain('LOCATION:Desert Garden Venue\\, Scottsdale\\, AZ');
  });

  it('exports the public wedding schedule in the calendar event', () => {
    const ics = generateIcs(siteContent.weddingEvent);

    expect(ics).toContain('DTSTART;TZID=America/Phoenix:20270117T163000');
    expect(ics).toContain('DTEND;TZID=America/Phoenix:20270117T223000');
    expect(ics).toContain(
      "UID:Matt & Alison's Wedding-20270117T233000Z@matt-alison-wedding",
    );
  });
});
