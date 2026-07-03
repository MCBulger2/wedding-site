import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WeddingSiteStack, type WeddingSiteStackProps } from './wedding-site-stack.js';

const webDistPath = path.resolve('apps/web/dist');
const webDistIndexPath = path.join(webDistPath, 'index.html');
let createdWebDistFixture = false;

function synthInviteCodePepper(envName: WeddingSiteStackProps['envName']) {
  const template = synthStackTemplate({
    env: { account: '123456789012', region: 'us-west-1' },
    envName,
    allowedOrigins: [],
    notificationRecipientEmails: [],
    enablePasskeys: false,
  });
  const inviteCodePepper = Object.values(template.Resources).find(
    (resource) =>
      resource &&
      typeof resource === 'object' &&
      'Type' in resource &&
      resource.Type === 'AWS::SecretsManager::Secret',
  );

  expect(inviteCodePepper).toBeDefined();

  return inviteCodePepper as {
    DeletionPolicy?: string;
    UpdateReplacePolicy?: string;
  };
}

function synthStackTemplate(props: WeddingSiteStackProps): Record<string, any> {
  const app = new cdk.App();
  const stack = new WeddingSiteStack(app, `WeddingSite-${props.envName}`, props);
  return Template.fromStack(stack).toJSON();
}

function templateResourcesOfType(
  template: Record<string, any>,
  type: string,
): Array<Record<string, any>> {
  return Object.values(template.Resources).filter(
    (resource): resource is Record<string, any> =>
      typeof resource === 'object' &&
      resource !== null &&
      'Type' in resource &&
      resource.Type === type,
  );
}

describe('WeddingSiteStack infrastructure', () => {
  beforeAll(() => {
    if (!fs.existsSync(webDistPath)) {
      fs.mkdirSync(webDistPath, { recursive: true });
      fs.writeFileSync(webDistIndexPath, '<!doctype html><title>test</title>');
      createdWebDistFixture = true;
    }
  });

  afterAll(() => {
    if (createdWebDistFixture) {
      fs.rmSync(webDistPath, { recursive: true, force: true });
    }
  });

  it('retains the pepper secret in production', () => {
    const inviteCodePepper = synthInviteCodePepper('production');

    expect(inviteCodePepper.DeletionPolicy).toBe('Retain');
    expect(inviteCodePepper.UpdateReplacePolicy).toBe('Retain');
  });

  it('keeps staging cleanup behavior for the pepper secret', () => {
    const inviteCodePepper = synthInviteCodePepper('staging');

    expect(inviteCodePepper.DeletionPolicy).not.toBe('Retain');
    expect(inviteCodePepper.UpdateReplacePolicy).not.toBe('Retain');
  });

  it('does not grant SNS publish permissions to the API handler', () => {
    const template = synthStackTemplate({
      env: { account: '123456789012', region: 'us-west-1' },
      envName: 'staging',
      allowedOrigins: [],
      notificationRecipientEmails: [],
      enablePasskeys: false,
    });

    expect(JSON.stringify(template)).not.toContain('sns:Publish');
  });

  it('imports the shared hosted-zone SES identity outside production', () => {
    const template = synthStackTemplate({
      env: { account: '123456789012', region: 'us-west-1' },
      envName: 'staging',
      allowedOrigins: [],
      hostedZoneDomain: 'matt-alison.com',
      frontendDomainName: 'staging.matt-alison.com',
      notificationSenderEmail: 'staging-rsvp@matt-alison.com',
      notificationRecipientEmails: ['guest@example.com'],
      enablePasskeys: false,
    });

    expect(templateResourcesOfType(template, 'AWS::SES::EmailIdentity')).toHaveLength(0);
    expect(JSON.stringify(template)).toContain('identity/matt-alison.com');
    expect(JSON.stringify(template)).toContain('staging-rsvp@matt-alison.com');
  });

  it('manages the hosted-zone SES identity in production', () => {
    const template = synthStackTemplate({
      env: { account: '123456789012', region: 'us-west-1' },
      envName: 'production',
      allowedOrigins: [],
      hostedZoneDomain: 'matt-alison.com',
      frontendDomainName: 'matt-alison.com',
      notificationSenderEmail: 'rsvp@matt-alison.com',
      notificationRecipientEmails: ['guest@example.com'],
      enablePasskeys: false,
    });
    const sesIdentities = templateResourcesOfType(template, 'AWS::SES::EmailIdentity');

    expect(sesIdentities).toHaveLength(1);
    expect(sesIdentities[0].Properties).toEqual(
      expect.objectContaining({ EmailIdentity: 'matt-alison.com' }),
    );
  });

  it('passes complete Twilio config as Lambda identifiers and grants secret read', () => {
    const app = new cdk.App();
    const stack = new WeddingSiteStack(app, 'WeddingSite-staging', {
      env: { account: '123456789012', region: 'us-west-1' },
      envName: 'staging',
      allowedOrigins: [],
      notificationRecipientEmails: [],
      twilioAccountSid: 'AC123',
      twilioApiKeySid: 'SK123',
      twilioApiKeySecretArn:
        'arn:aws:secretsmanager:us-west-1:123456789012:secret:twilio-api-key-AbCdEf',
      twilioMessagingServiceSid: 'MG123',
      enablePasskeys: false,
    });
    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          TWILIO_ACCOUNT_SID: 'AC123',
          TWILIO_API_KEY_SID: 'SK123',
          TWILIO_API_KEY_SECRET_ARN:
            'arn:aws:secretsmanager:us-west-1:123456789012:secret:twilio-api-key-AbCdEf',
          TWILIO_MESSAGING_SERVICE_SID: 'MG123',
        }),
      },
    });
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith(['secretsmanager:GetSecretValue']),
            Resource:
              'arn:aws:secretsmanager:us-west-1:123456789012:secret:twilio-api-key-AbCdEf',
          }),
        ]),
      },
    });
  });
});
