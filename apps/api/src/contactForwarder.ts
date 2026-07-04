import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import type { S3Event } from 'aws-lambda';
import { describeError, getErrorStatusCode, logStructured } from './logger.js';

export interface ContactForwardingConfig {
  contactEmailAddress?: string;
  forwardingRecipientEmail?: string;
}

interface ContactForwardingDependencies {
  s3Client: Pick<S3Client, 'send'>;
  sesClient: Pick<SESv2Client, 'send'>;
  config: ContactForwardingConfig;
}

interface ForwardedEmail {
  subject: string;
  text: string;
  replyToAddress?: string;
  messageId?: string;
}

const missingConfigMessage =
  'CONTACT_EMAIL_ADDRESS and CONTACT_FORWARDING_RECIPIENT_EMAIL must be configured';

const defaultS3Client = new S3Client({});
const defaultSesClient = new SESv2Client({});

export async function handler(event: S3Event): Promise<void> {
  await forwardContactEmails(event, {
    s3Client: defaultS3Client,
    sesClient: defaultSesClient,
    config: {
      contactEmailAddress: process.env.CONTACT_EMAIL_ADDRESS,
      forwardingRecipientEmail: process.env.CONTACT_FORWARDING_RECIPIENT_EMAIL,
    },
  });
}

export async function forwardContactEmails(
  event: S3Event,
  dependencies: ContactForwardingDependencies,
): Promise<void> {
  const contactEmailAddress = dependencies.config.contactEmailAddress?.trim();
  const forwardingRecipientEmail =
    dependencies.config.forwardingRecipientEmail?.trim();

  if (!contactEmailAddress || !forwardingRecipientEmail) {
    logStructured({
      level: 'error',
      event: 'contact.forwarding.configMissing',
      message: 'Contact forwarding configuration is missing',
      outcome: 'failed',
    });
    throw new Error(missingConfigMessage);
  }

  logStructured({
    level: 'info',
    event: 'contact.forwarding.started',
    message: 'Contact forwarding started',
    recordCount: event.Records.length,
  });

  let processedCount = 0;
  for (const record of event.Records) {
    const bucketName = record.s3.bucket.name;
    const objectKey = decodeS3ObjectKey(record.s3.object.key);
    try {
      const rawMessage = await readS3ObjectAsString(
        dependencies.s3Client,
        bucketName,
        objectKey,
      );
      const email = buildForwardedContactEmail(rawMessage);

      await dependencies.sesClient.send(
        new SendEmailCommand({
          FromEmailAddress: contactEmailAddress,
          Destination: {
            ToAddresses: [forwardingRecipientEmail],
          },
          ReplyToAddresses: email.replyToAddress
            ? [email.replyToAddress]
            : undefined,
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

      processedCount += 1;
      logStructured({
        level: 'info',
        event: 'contact.forwarded',
        message: 'Contact email forwarded',
        outcome: 'success',
        bucketName,
        objectKey,
        messageId: email.messageId,
        processedCount,
      });
    } catch (error) {
      logStructured({
        level: 'error',
        event: 'contact.forwarding.failed',
        message: 'Contact email forwarding failed',
        outcome: 'failed',
        bucketName,
        objectKey,
        statusCode: getErrorStatusCode(error),
        ...describeError(error),
      });
      throw error;
    }
  }

  logStructured({
    level: 'info',
    event: 'contact.forwarding.completed',
    message: 'Contact forwarding completed',
    outcome: 'success',
    recordCount: event.Records.length,
    processedCount,
  });
}

export function buildForwardedContactEmail(rawMessage: string): ForwardedEmail {
  const { headers, body } = parseRawEmail(rawMessage);
  const originalFrom = sanitizeHeaderValue(headers.get('from')) ?? 'Unknown sender';
  const originalDate = sanitizeHeaderValue(headers.get('date')) ?? 'Unknown date';
  const originalSubject =
    sanitizeHeaderValue(headers.get('subject')) ?? '(no subject)';
  const messageId = sanitizeHeaderValue(headers.get('message-id'));
  const replyToAddress = parseSafeEmailAddress(originalFrom);
  const forwardedBody = body.trim() || '(No message body was included.)';

  return {
    subject: `Fwd: ${originalSubject}`,
    replyToAddress,
    messageId,
    text: [
      'A guest sent a message to contact@matt-alison.com.',
      '',
      `Original From: ${originalFrom}`,
      `Original Date: ${originalDate}`,
      `Original Subject: ${originalSubject}`,
      messageId ? `Original Message-ID: ${messageId}` : undefined,
      '',
      'Original message:',
      forwardedBody,
    ]
      .filter((line): line is string => line !== undefined)
      .join('\n'),
  };
}

function parseRawEmail(rawMessage: string): {
  headers: Map<string, string>;
  body: string;
} {
  const separator = /\r?\n\r?\n/.exec(rawMessage);
  const headerText = separator
    ? rawMessage.slice(0, separator.index)
    : rawMessage;
  const body = separator
    ? rawMessage.slice(separator.index + separator[0].length)
    : '';
  const headers = new Map<string, string>();
  let currentHeaderName: string | undefined;

  for (const line of headerText.split(/\r?\n/)) {
    if (/^\s/.test(line) && currentHeaderName) {
      headers.set(
        currentHeaderName,
        `${headers.get(currentHeaderName) ?? ''} ${line.trim()}`,
      );
      continue;
    }

    const separatorIndex = line.indexOf(':');
    if (separatorIndex <= 0) {
      currentHeaderName = undefined;
      continue;
    }

    currentHeaderName = line.slice(0, separatorIndex).trim().toLowerCase();
    if (!headers.has(currentHeaderName)) {
      headers.set(currentHeaderName, line.slice(separatorIndex + 1).trim());
    }
  }

  return { headers, body };
}

async function readS3ObjectAsString(
  s3Client: Pick<S3Client, 'send'>,
  bucketName: string,
  objectKey: string,
): Promise<string> {
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    }),
  );
  const body = response.Body;

  if (!body || typeof body.transformToString !== 'function') {
    throw new Error(`Inbound contact email object is empty: ${objectKey}`);
  }

  return body.transformToString('utf-8');
}

function decodeS3ObjectKey(objectKey: string): string {
  return decodeURIComponent(objectKey.replace(/\+/g, ' '));
}

function sanitizeHeaderValue(value: string | undefined): string | undefined {
  const sanitized = value?.replace(/[\r\n]+/g, ' ').trim();
  return sanitized ? sanitized : undefined;
}

function parseSafeEmailAddress(value: string): string | undefined {
  const candidate =
    /<([^<>\s]+@[^<>\s]+)>/.exec(value)?.[1] ??
    /([A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/.exec(
      value,
    )?.[1];

  if (
    !candidate ||
    candidate.length > 320 ||
    /[\r\n,<>]/.test(candidate) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)
  ) {
    return undefined;
  }

  return candidate;
}
