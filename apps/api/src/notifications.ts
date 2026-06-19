import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import type { Household, StoredRsvp } from '@matt-alison-wedding/shared';

export interface RsvpNotificationInput {
  household: Household;
  rsvp: StoredRsvp;
}

export interface RsvpNotifier {
  notifyRsvpChanged(input: RsvpNotificationInput): Promise<void>;
}

export interface SesRsvpNotifierConfig {
  senderEmail: string;
  recipientEmails: string[];
  adminDashboardUrl: string;
}

export class SesRsvpNotifier implements RsvpNotifier {
  constructor(
    private readonly config: SesRsvpNotifierConfig,
    private readonly client = new SESv2Client({}),
  ) {}

  async notifyRsvpChanged(input: RsvpNotificationInput): Promise<void> {
    const email = buildRsvpNotificationEmail(input, this.config.adminDashboardUrl);

    await this.client.send(
      new SendEmailCommand({
        FromEmailAddress: this.config.senderEmail,
        Destination: {
          ToAddresses: this.config.recipientEmails,
        },
        Content: {
          Simple: {
            Subject: {
              Charset: 'UTF-8',
              Data: email.subject,
            },
            Body: {
              Text: {
                Charset: 'UTF-8',
                Data: email.text,
              },
            },
          },
        },
      }),
    );
  }
}

export function buildRsvpNotificationEmail(
  { household, rsvp }: RsvpNotificationInput,
  adminDashboardUrl: string,
): { subject: string; text: string } {
  const attendingMembers = rsvp.members.filter((member) => member.attending).length;
  const declinedMembers = rsvp.members.length - attendingMembers;
  const plusOnes = rsvp.plusOnes.length;
  const totalAttending = attendingMembers + plusOnes;

  return {
    subject: `RSVP updated: ${household.displayName}`,
    text: [
      `${household.displayName} updated their RSVP.`,
      '',
      `Status: ${household.rsvpStatus}`,
      `Attending guests: ${totalAttending}`,
      `Declined household guests: ${declinedMembers}`,
      `Plus-ones: ${plusOnes}`,
      `Submitted: ${rsvp.submittedAt}`,
      `Updated: ${rsvp.updatedAt}`,
      '',
      `Admin dashboard: ${adminDashboardUrl}`,
    ].join('\n'),
  };
}

export function createNotifierFromEnvironment(): RsvpNotifier | undefined {
  const senderEmail = process.env.RSVP_NOTIFICATION_SENDER_EMAIL;
  const recipientEmails = splitCsv(process.env.RSVP_NOTIFICATION_RECIPIENT_EMAILS);
  const adminDashboardUrl = process.env.ADMIN_DASHBOARD_URL;

  if (!senderEmail || recipientEmails.length === 0 || !adminDashboardUrl) {
    return undefined;
  }

  return new SesRsvpNotifier({
    senderEmail,
    recipientEmails,
    adminDashboardUrl,
  });
}

function splitCsv(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}
