import { GetObjectCommand } from '@aws-sdk/client-s3';
import { SendEmailCommand } from '@aws-sdk/client-sesv2';
import type { S3Event } from 'aws-lambda';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildForwardedContactEmail,
  forwardContactEmails,
} from './contactForwarder.js';

describe('contactForwarder', () => {
  let consoleLog: ReturnType<typeof vi.spyOn>;
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('forwards contact email to the configured recipient with Reply-To', async () => {
    const s3Client = new RecordingS3Client(
      [
        'From: Guest Sender <guest@example.com>',
        'Date: Sun, 28 Jun 2026 10:00:00 -0700',
        'Subject: Hotel question',
        'Message-ID: <message-1@example.com>',
        '',
        'Can you confirm the hotel block code?',
      ].join('\r\n'),
    );
    const sesClient = new RecordingSesClient();

    await forwardContactEmails(createS3Event('inbound/contact-1.eml'), {
      s3Client,
      sesClient,
      config: {
        contactEmailAddress: 'contact@matt-alison.com',
        forwardingRecipientEmail: 'matt.alison.2020@gmail.com',
      },
    });

    expect(s3Client.commands[0]).toBeInstanceOf(GetObjectCommand);
    expect(s3Client.commands[0].input).toMatchObject({
      Bucket: 'contact-bucket',
      Key: 'inbound/contact-1.eml',
    });
    expect(sesClient.commands).toHaveLength(1);
    expect(sesClient.commands[0]).toBeInstanceOf(SendEmailCommand);
    expect(sesClient.commands[0].input).toMatchObject({
      FromEmailAddress: 'contact@matt-alison.com',
      Destination: {
        ToAddresses: ['matt.alison.2020@gmail.com'],
      },
      ReplyToAddresses: ['guest@example.com'],
    });
    const simple = sesClient.commands[0].input.Content?.Simple;
    expect(simple?.Subject?.Data).toBe('Fwd: Hotel question');
    expect(simple?.Body?.Text?.Data).toContain(
      'Original From: Guest Sender <guest@example.com>',
    );
    expect(simple?.Body?.Text?.Data).toContain(
      'Can you confirm the hotel block code?',
    );
    const logs = parseConsoleJson(consoleLog);
    expect(logs).toContainEqual(
      expect.objectContaining({
        level: 'info',
        event: 'contact.forwarded',
        bucketName: 'contact-bucket',
        objectKey: 'inbound/contact-1.eml',
        outcome: 'success',
      }),
    );
    const serialized = JSON.stringify(logs);
    expect(serialized).not.toContain('guest@example.com');
    expect(serialized).not.toContain('Hotel question');
    expect(serialized).not.toContain('Can you confirm the hotel block code?');
    expect(serialized).not.toContain('matt.alison.2020@gmail.com');
  });

  it('handles malformed or missing headers without setting Reply-To', async () => {
    const email = buildForwardedContactEmail(
      ['From: not-an-email', 'Subject:', '', 'Body only'].join('\n'),
    );

    expect(email.subject).toBe('Fwd: (no subject)');
    expect(email.replyToAddress).toBeUndefined();
    expect(email.text).toContain('Original From: not-an-email');
    expect(email.text).toContain('Original Date: Unknown date');
    expect(email.text).toContain('Body only');
  });

  it('fails clearly when required environment config is missing', async () => {
    await expect(
      forwardContactEmails(createS3Event('inbound/contact-1.eml'), {
        s3Client: new RecordingS3Client('From: guest@example.com\n\nHello'),
        sesClient: new RecordingSesClient(),
        config: {
          contactEmailAddress: 'contact@matt-alison.com',
        },
      }),
    ).rejects.toThrow(
      'CONTACT_EMAIL_ADDRESS and CONTACT_FORWARDING_RECIPIENT_EMAIL must be configured',
    );
    expect(parseConsoleJson(consoleError)).toContainEqual(
      expect.objectContaining({
        level: 'error',
        event: 'contact.forwarding.configMissing',
        outcome: 'failed',
      }),
    );
  });
});

class RecordingS3Client {
  readonly commands: GetObjectCommand[] = [];

  constructor(private readonly rawMessage: string) {}

  async send(command: GetObjectCommand): Promise<object> {
    this.commands.push(command);
    return {
      Body: {
        transformToString: async () => this.rawMessage,
      },
    };
  }
}

class RecordingSesClient {
  readonly commands: SendEmailCommand[] = [];

  async send(command: SendEmailCommand): Promise<object> {
    this.commands.push(command);
    return {};
  }
}

function createS3Event(objectKey: string): S3Event {
  return {
    Records: [
      {
        s3: {
          bucket: {
            name: 'contact-bucket',
          },
          object: {
            key: objectKey,
          },
        },
      },
    ],
  } as S3Event;
}

function parseConsoleJson(spy: ReturnType<typeof vi.spyOn>): Array<Record<string, unknown>> {
  return spy.mock.calls.map((call: unknown[]) => JSON.parse(call[0] as string));
}
