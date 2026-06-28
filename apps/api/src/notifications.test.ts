import { SNSClient } from '@aws-sdk/client-sns';
import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import {
  siteContent,
  type Household,
  type StoredRsvp,
} from '@matt-alison-wedding/shared';
import { describe, expect, it } from 'vitest';
import {
  AwsWeddingNotificationsClient,
  buildInvitationEmail,
  buildRecoveryEmail,
  buildRecoverySms,
  buildHouseholdNotificationEmail,
  buildRsvpNotificationEmail,
} from './notifications.js';

describe('notifications', () => {
  it('builds styled household emails from shared frontend wedding content', () => {
    const email = buildHouseholdNotificationEmail(
      {
        channel: 'email',
        household: createHousehold(),
        subject: 'Your wedding invitation',
        message:
          'We would love to celebrate with you.\nPlease RSVP when you can.',
      },
      'https://wedding.example.com',
    );

    expect(email.text).toContain(siteContent.dateLabel);
    expect(email.text).toContain(siteContent.venueName);
    expect(email.text).toContain(siteContent.rsvpDeadline);
    expect(email.html).toContain('Matt &amp; Alison');
    expect(email.html).toContain(siteContent.ceremonyTime);
    expect(email.html).toContain('Open wedding website');
    expect(email.html).toContain('https://wedding.example.com');
  });

  it('escapes guest-authored notification messages in HTML emails', () => {
    const email = buildHouseholdNotificationEmail({
      channel: 'email',
      household: createHousehold(),
      subject: 'Schedule update',
      message: 'Ceremony update <script>alert("x")</script>',
    });

    expect(email.text).toContain('<script>alert("x")</script>');
    expect(email.html).toContain(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
    );
    expect(email.html).not.toContain('<script>');
  });

  it('sends household email notifications with text and HTML bodies', async () => {
    const sesClient = new RecordingSesClient();
    const client = new AwsWeddingNotificationsClient(
      {
        senderEmail: 'rsvp@example.com',
        recipientEmails: [],
        publicWebsiteUrl: 'https://wedding.example.com',
      },
      sesClient as unknown as SESv2Client,
      new SNSClient({}),
    );

    await client.sendHouseholdNotification({
      channel: 'email',
      household: createHousehold(),
      subject: 'Invitation details',
      message: 'Your invitation details are ready.',
    });

    expect(sesClient.commands).toHaveLength(1);
    const body = sesClient.commands[0].input.Content?.Simple?.Body;
    expect(body?.Text?.Data).toContain('Your invitation details are ready.');
    expect(body?.Html?.Data).toContain('Matt &amp; Alison');
    expect(body?.Html?.Data).toContain('Open wedding website');
  });

  it('builds styled RSVP admin emails without invite-code secrets', () => {
    const household = createHousehold({
      inviteCodeHash: 'secret-hash-value',
      rsvpStatus: 'partial',
    });
    const rsvp: StoredRsvp = {
      members: [
        {
          memberId: 'h1-1',
          attending: true,
          mealChoice: 'chicken',
          dietaryNotes: '',
        },
        {
          memberId: 'h1-2',
          attending: false,
          mealChoice: 'none',
          dietaryNotes: '',
        },
      ],
      plusOnes: [],
      notes: '',
      accessibilityNotes: '',
      submittedAt: '2026-06-26T18:00:00.000Z',
      updatedAt: '2026-06-26T18:30:00.000Z',
    };

    const email = buildRsvpNotificationEmail(
      { household, rsvp },
      'https://wedding.example.com/admin',
    );

    expect(email.html).toContain('RSVP updated');
    expect(email.html).toContain('Open admin dashboard');
    expect(email.html).toContain('Attending guests');
    expect(email.html).not.toContain('secret-hash-value');
    expect(email.text).not.toContain('secret-hash-value');
  });

  it('builds styled invitation emails with the private RSVP URL and shared wedding content', () => {
    const email = buildInvitationEmail({
      household: createHousehold(),
      invitation: {
        householdId: 'h1',
        inviteCode: 'A2B3C4D5E6',
        inviteCodeHash: 'hash-value',
        rsvpUrl: 'https://wedding.example.com/rsvp/A2B3C4D5E6',
      },
    });

    expect(email.subject).toBe("You're invited to Matt and Alison's wedding");
    expect(email.text).toContain('https://wedding.example.com/rsvp/A2B3C4D5E6');
    expect(email.text).toContain('Invitation code: A2B3C4D5E6');
    expect(email.text).toContain('Questions? Email us at contact@matt-alison.com.');
    expect(email.html).toContain('Open your RSVP');
    expect(email.html).toContain('https://wedding.example.com/rsvp/A2B3C4D5E6');
    expect(email.html).toContain('Invitation code');
    expect(email.html).toContain('A2B3C4D5E6');
    expect(email.html).toContain('contact@matt-alison.com');
    expect(email.html).toContain(siteContent.venueName);
    expect(email.html).toContain(siteContent.rsvpDeadline);
  });

  it('sends invitation emails with text and styled HTML bodies', async () => {
    const sesClient = new RecordingSesClient();
    const client = new AwsWeddingNotificationsClient(
      {
        senderEmail: 'rsvp@example.com',
        recipientEmails: [],
      },
      sesClient as unknown as SESv2Client,
      new SNSClient({}),
    );

    await client.sendInvitationEmail({
      household: createHousehold(),
      invitation: {
        householdId: 'h1',
        inviteCode: 'A2B3C4D5E6',
        inviteCodeHash: 'hash-value',
        rsvpUrl: 'https://wedding.example.com/rsvp/A2B3C4D5E6',
      },
    });

    expect(sesClient.commands).toHaveLength(1);
    const body = sesClient.commands[0].input.Content?.Simple?.Body;
    expect(body?.Text?.Data).toContain('contact@matt-alison.com');
    expect(body?.Html?.Data).toContain('Matt &amp; Alison');
    expect(body?.Html?.Data).toContain('Open your RSVP');
    expect(body?.Html?.Data).toContain('A2B3C4D5E6');
    expect(body?.Html?.Data).toContain('contact@matt-alison.com');
  });

  it('builds recovery email content with the private RSVP link and no separate invite code field', () => {
    const email = buildRecoveryEmail({
      household: createHousehold(),
      invitation: {
        householdId: 'h1',
        inviteCode: 'A2B3C4D5E6',
        inviteCodeHash: 'hash-value',
        rsvpUrl: 'https://wedding.example.com/rsvp/A2B3C4D5E6',
      },
    });

    expect(email.text).toContain('https://wedding.example.com/rsvp/A2B3C4D5E6');
    expect(email.text).not.toContain('Invitation code:');
    expect(email.html).toContain('Open your RSVP');
    expect(email.html).not.toContain('Invitation code');
  });

  it('builds recovery SMS content with only the private RSVP link', () => {
    const message = buildRecoverySms({
      household: createHousehold({ phone: '+14805550100' }),
      invitation: {
        householdId: 'h1',
        inviteCode: 'A2B3C4D5E6',
        inviteCodeHash: 'hash-value',
        rsvpUrl: 'https://wedding.example.com/rsvp/A2B3C4D5E6',
      },
    });

    expect(message).toContain('https://wedding.example.com/rsvp/A2B3C4D5E6');
    expect(message).not.toContain('Invitation code');
  });
});

class RecordingSesClient {
  readonly commands: SendEmailCommand[] = [];

  async send(command: SendEmailCommand): Promise<object> {
    this.commands.push(command);
    return {};
  }
}

function createHousehold(overrides: Partial<Household> = {}): Household {
  return {
    householdId: 'h1',
    displayName: 'The Example Household',
    email: 'guest@example.com',
    members: [
      {
        id: 'h1-1',
        firstName: 'Sam',
        lastName: 'Example',
        canBringPlusOne: true,
      },
      {
        id: 'h1-2',
        firstName: 'Taylor',
        lastName: 'Example',
        canBringPlusOne: false,
      },
    ],
    maxPlusOnes: 1,
    rsvpStatus: 'not_started',
    inviteLifecycleStatus: 'generated',
    inviteCodeHash: 'hash-value',
    inviteCodeGeneratedAt: '2026-06-26T17:00:00.000Z',
    createdAt: '2026-06-26T17:00:00.000Z',
    updatedAt: '2026-06-26T17:00:00.000Z',
    ...overrides,
  };
}
