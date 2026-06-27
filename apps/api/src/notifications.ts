import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import { siteContent } from '@matt-alison-wedding/shared';
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
  publicWebsiteUrl?: string;
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
              Html: {
                Charset: 'UTF-8',
                Data: email.html,
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

      const email = buildHouseholdNotificationEmail(input, this.config.publicWebsiteUrl);

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
                Html: {
                  Charset: 'UTF-8',
                  Data: email.html,
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
): { subject: string; text: string; html: string } {
  const attendingMembers = rsvp.members.filter((member) => member.attending).length;
  const declinedMembers = rsvp.members.length - attendingMembers;
  const plusOnes = rsvp.plusOnes.length;
  const totalAttending = attendingMembers + plusOnes;
  const subject = `RSVP updated: ${household.displayName}`;
  const summaryRows: Array<[label: string, value: string]> = [
    ['Status', household.rsvpStatus],
    ['Attending guests', String(totalAttending)],
    ['Declined household guests', String(declinedMembers)],
    ['Plus-ones', String(plusOnes)],
    ['Submitted', rsvp.submittedAt],
    ['Updated', rsvp.updatedAt],
  ];

  return {
    subject,
    text: [
      `${household.displayName} updated their RSVP.`,
      '',
      ...summaryRows.map(([label, value]) => `${label}: ${value}`),
      '',
      `Admin dashboard: ${adminDashboardUrl}`,
    ].join('\n'),
    html: buildEmailDocument({
      previewText: `${household.displayName} updated their RSVP.`,
      title: 'RSVP updated',
      subtitle: household.displayName,
      intro: `${household.displayName} updated their RSVP for Matt & Alison's wedding.`,
      rows: summaryRows,
      cta: {
        label: 'Open admin dashboard',
        url: adminDashboardUrl,
      },
      footer:
        'This admin notification does not include invite codes or private RSVP links.',
    }),
  };
}

export function buildHouseholdNotificationEmail(
  input: HouseholdNotificationInput & { channel: 'email' },
  publicWebsiteUrl?: string,
): { subject: string; text: string; html: string } {
  const text = [
    input.message,
    '',
    `${siteContent.coupleNames}`,
    `${siteContent.dateLabel} in ${siteContent.location}`,
    `${siteContent.venueName}`,
    `${siteContent.ceremonyTime} ceremony`,
    `${siteContent.receptionTime} dinner & reception`,
    `Dress code: ${siteContent.dressCode}`,
    `RSVP by ${siteContent.rsvpDeadline}.`,
    publicWebsiteUrl ? `Wedding website: ${publicWebsiteUrl}` : undefined,
    'Please use the private RSVP link from your invitation to respond.',
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');

  return {
    subject: input.subject,
    text,
    html: buildEmailDocument({
      previewText: input.subject,
      title: siteContent.coupleNames,
      subtitle: siteContent.dateLabel,
      intro: input.message,
      rows: [
        ['Where', `${siteContent.venueName}, ${siteContent.location}`],
        ['When', `${siteContent.dateLabel} at ${siteContent.ceremonyTime}`],
        ['Reception', `${siteContent.receptionTime} dinner & reception`],
        ['Dress code', siteContent.dressCode],
        ['RSVP by', siteContent.rsvpDeadline],
      ],
      schedule: siteContent.schedule,
      cta: publicWebsiteUrl
        ? {
            label: 'Open wedding website',
            url: publicWebsiteUrl,
          }
        : undefined,
      footer:
        'Please use the private RSVP link from your invitation to respond. This email never includes invite-code secrets.',
    }),
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
    publicWebsiteUrl: resolveOptionalValue(process.env.FRONTEND_BASE_URL),
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
    publicWebsiteUrl: resolveOptionalValue(process.env.FRONTEND_BASE_URL),
  });
}

interface EmailDocumentInput {
  previewText: string;
  title: string;
  subtitle: string;
  intro: string;
  rows: Array<[label: string, value: string]>;
  schedule?: Array<{ time: string; detail: string }>;
  cta?: { label: string; url: string };
  footer: string;
}

function buildEmailDocument(input: EmailDocumentInput): string {
  const ctaHtml = input.cta
    ? `
                    <tr>
                      <td align="center" style="${styles.ctaWrap}">
                        <a href="${escapeHtmlAttribute(input.cta.url)}" style="${styles.cta}">
                          ${escapeHtml(input.cta.label)}
                        </a>
                      </td>
                    </tr>`
    : '';
  const scheduleHtml = input.schedule
    ? `
                    <tr>
                      <td style="${styles.section}">
                        <p style="${styles.sectionTitle}">Wedding day</p>
                        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                          ${input.schedule
                            .map(
                              (entry) => `
                          <tr>
                            <td style="${styles.scheduleTime}">${escapeHtml(entry.time)}</td>
                            <td style="${styles.scheduleDetail}">${escapeHtml(entry.detail)}</td>
                          </tr>`,
                            )
                            .join('')}
                        </table>
                      </td>
                    </tr>`
    : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(input.title)}</title>
  </head>
  <body style="${styles.body}">
    <div style="${styles.preview}">${escapeHtml(input.previewText)}</div>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="${styles.page}">
      <tr>
        <td align="center" style="${styles.outer}">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="${styles.card}">
            <tr>
              <td style="${styles.header}">
                <p style="${styles.names}">${escapeHtml(input.title)}</p>
                <p style="${styles.date}">${escapeHtml(input.subtitle)}</p>
              </td>
            </tr>
            <tr>
              <td style="${styles.content}">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td style="${styles.intro}">
                      ${formatMessageHtml(input.intro)}
                    </td>
                  </tr>
                  <tr>
                    <td style="${styles.detailsBox}">
                      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                        ${input.rows
                          .map(
                            ([label, value]) => `
                        <tr>
                          <td style="${styles.detailLabel}">${escapeHtml(label)}</td>
                          <td style="${styles.detailValue}">${escapeHtml(value)}</td>
                        </tr>`,
                          )
                          .join('')}
                      </table>
                    </td>
                  </tr>${ctaHtml}${scheduleHtml}
                </table>
              </td>
            </tr>
            <tr>
              <td style="${styles.footer}">
                ${escapeHtml(input.footer)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function formatMessageHtml(message: string): string {
  return message
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p style="${styles.paragraph}">${escapeHtml(line)}</p>`)
    .join('');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

const styles = {
  body:
    'margin:0;padding:0;background:#f7f2ec;color:#2e3432;font-family:Georgia, Times, serif;',
  page: 'background:#f7f2ec;margin:0;padding:0;width:100%;',
  preview:
    'display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;color:#f7f2ec;',
  outer: 'padding:32px 16px;',
  card:
    'max-width:640px;background:#fffffb;border:1px solid #e8dccd;border-radius:8px;overflow:hidden;border-collapse:separate;',
  header:
    'padding:42px 40px 34px;background:#315f53;color:#fffffb;text-align:center;border-bottom:6px solid #c78f57;',
  names:
    'margin:0;font-family:Georgia, Times, serif;font-size:36px;line-height:42px;font-weight:400;letter-spacing:0;color:#fffffb;',
  date:
    'margin:14px 0 0;font-family:Arial, Helvetica, sans-serif;font-size:14px;line-height:22px;font-weight:700;letter-spacing:0;color:#f4e6d8;text-transform:uppercase;',
  content: 'padding:34px 40px 38px;',
  intro:
    'padding:0 0 22px;font-family:Arial, Helvetica, sans-serif;font-size:17px;line-height:27px;color:#3d464c;',
  paragraph:
    'margin:0 0 12px;font-family:Arial, Helvetica, sans-serif;font-size:17px;line-height:27px;color:#3d464c;',
  detailsBox:
    'padding:20px 22px;background:#fbf7f1;border:1px solid #eadfce;border-radius:8px;',
  detailLabel:
    'width:34%;padding:10px 12px 10px 0;font-family:Arial, Helvetica, sans-serif;font-size:12px;line-height:18px;font-weight:700;text-transform:uppercase;color:#9b5f40;vertical-align:top;',
  detailValue:
    'padding:10px 0;font-family:Arial, Helvetica, sans-serif;font-size:15px;line-height:22px;color:#2e3432;vertical-align:top;',
  ctaWrap: 'padding:28px 0 8px;',
  cta:
    'display:inline-block;background:#9b5f40;color:#fffffb;text-decoration:none;border-radius:4px;padding:14px 24px;font-family:Arial, Helvetica, sans-serif;font-size:15px;line-height:20px;font-weight:700;',
  section: 'padding:26px 0 0;',
  sectionTitle:
    'margin:0 0 12px;font-family:Georgia, Times, serif;font-size:24px;line-height:30px;font-weight:400;color:#315f53;',
  scheduleTime:
    'width:96px;padding:10px 14px 10px 0;border-top:1px solid #eadfce;font-family:Arial, Helvetica, sans-serif;font-size:13px;line-height:20px;font-weight:700;color:#9b5f40;white-space:nowrap;',
  scheduleDetail:
    'padding:10px 0;border-top:1px solid #eadfce;font-family:Arial, Helvetica, sans-serif;font-size:15px;line-height:22px;color:#2e3432;',
  footer:
    'padding:22px 40px;background:#f3eadf;border-top:1px solid #e8dccd;font-family:Arial, Helvetica, sans-serif;font-size:12px;line-height:19px;color:#667077;text-align:center;',
};

function splitCsv(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function resolveOptionalValue(...values: Array<string | undefined>): string | undefined {
  return values.map((value) => value?.trim()).find(Boolean);
}
