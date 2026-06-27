import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import type {
  Household,
  InvitationEmailResult,
  InvitationDetails,
  SendHouseholdNotificationInput,
  SendHouseholdNotificationResponse,
  StoredRsvp,
} from '@matt-alison-wedding/shared';

export interface RsvpNotificationInput {
  household: Household;
  rsvp: StoredRsvp;
}

export interface RsvpNotifier {
  notifyRsvpChanged(input: RsvpNotificationInput): Promise<void>;
}

export type HouseholdNotificationInput = SendHouseholdNotificationInput & {
  household: Household;
};

export interface HouseholdMessenger {
  sendHouseholdNotification(
    input: HouseholdNotificationInput,
  ): Promise<SendHouseholdNotificationResponse>;
  sendInvitationEmail(input: InvitationEmailInput): Promise<InvitationEmailResult>;
}

export interface InvitationEmailInput {
  household: Household;
  invitation: InvitationDetails;
}

export interface WeddingNotificationsConfig {
  senderEmail?: string;
  recipientEmails: string[];
  adminDashboardUrl?: string;
}

export class AwsWeddingNotificationsClient
  implements RsvpNotifier, HouseholdMessenger
{
  constructor(
    private readonly config: WeddingNotificationsConfig,
    private readonly sesClient = new SESv2Client({}),
    private readonly snsClient = new SNSClient({}),
  ) {}

  async notifyRsvpChanged(input: RsvpNotificationInput): Promise<void> {
    if (
      !this.config.senderEmail ||
      this.config.recipientEmails.length === 0 ||
      !this.config.adminDashboardUrl
    ) {
      throw new Error('RSVP admin email notifications are not fully configured');
    }

    const email = buildRsvpNotificationEmail(input, this.config.adminDashboardUrl);

    await this.sesClient.send(
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

  async sendHouseholdNotification(
    input: HouseholdNotificationInput,
  ): Promise<SendHouseholdNotificationResponse> {
    if (input.channel === 'email') {
      if (!this.config.senderEmail) {
        throw new Error('Email notifications are not configured');
      }
      if (!input.household.email) {
        throw new Error('Household does not have a contact email address');
      }

      await this.sesClient.send(
        new SendEmailCommand({
          FromEmailAddress: this.config.senderEmail,
          Destination: {
            ToAddresses: [input.household.email],
          },
          Content: {
            Simple: {
              Subject: {
                Charset: 'UTF-8',
                Data: input.subject,
              },
              Body: {
                Text: {
                  Charset: 'UTF-8',
                  Data: input.message,
                },
              },
            },
          },
        }),
      );

      return {
        channel: 'email',
        deliveredTo: input.household.email,
      };
    }

    if (!input.household.phone) {
      throw new Error('Household does not have a contact mobile number');
    }

    await this.snsClient.send(
      new PublishCommand({
        PhoneNumber: input.household.phone,
        Message: input.message,
      }),
    );

    return {
      channel: 'sms',
      deliveredTo: input.household.phone,
    };
  }

  async sendInvitationEmail(input: InvitationEmailInput): Promise<InvitationEmailResult> {
    if (!this.config.senderEmail) {
      throw new Error('Email notifications are not configured');
    }
    if (!input.household.email) {
      throw new Error('Household does not have a contact email address');
    }

    const email = buildInvitationEmail(input);
    await this.sesClient.send(
      new SendEmailCommand({
        FromEmailAddress: this.config.senderEmail,
        Destination: {
          ToAddresses: [input.household.email],
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

    return {
      householdId: input.household.householdId,
      displayName: input.household.displayName,
      status: 'sent',
      deliveredTo: input.household.email,
      message: `Sent invitation email to ${input.household.email}`,
    };
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

export function buildInvitationEmail({
  household,
  invitation,
}: InvitationEmailInput): { subject: string; text: string } {
  return {
    subject: "You're invited to Matt and Alison's wedding",
    text: [
      `Hi ${household.displayName},`,
      '',
      "You're invited to Matt and Alison's wedding.",
      '',
      'Please use your private RSVP link to view your household and respond:',
      invitation.rsvpUrl,
      '',
      `Invitation code: ${invitation.inviteCode}`,
      '',
      'We will still send a paper invitation as well, but this email gives you the same private RSVP access.',
      '',
      'With love,',
      'Matt and Alison',
    ].join('\n'),
  };
}

export function createNotifierFromEnvironment(): RsvpNotifier | undefined {
  const senderEmail = resolveOptionalValue(
    process.env.NOTIFICATION_SENDER_EMAIL,
    process.env.RSVP_NOTIFICATION_SENDER_EMAIL,
  );
  const recipientEmails = splitCsv(process.env.RSVP_NOTIFICATION_RECIPIENT_EMAILS);
  const adminDashboardUrl = resolveOptionalValue(process.env.ADMIN_DASHBOARD_URL);

  if (!senderEmail || recipientEmails.length === 0 || !adminDashboardUrl) {
    return undefined;
  }

  return new AwsWeddingNotificationsClient({
    senderEmail,
    recipientEmails,
    adminDashboardUrl,
  });
}

export function createHouseholdMessengerFromEnvironment(): HouseholdMessenger {
  const senderEmail = resolveOptionalValue(
    process.env.NOTIFICATION_SENDER_EMAIL,
    process.env.RSVP_NOTIFICATION_SENDER_EMAIL,
  );

  return new AwsWeddingNotificationsClient({
    senderEmail,
    recipientEmails: splitCsv(process.env.RSVP_NOTIFICATION_RECIPIENT_EMAILS),
    adminDashboardUrl: resolveOptionalValue(process.env.ADMIN_DASHBOARD_URL),
  });
}

function splitCsv(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function resolveOptionalValue(...values: Array<string | undefined>): string | undefined {
  return values.map((value) => value?.trim()).find(Boolean);
}
