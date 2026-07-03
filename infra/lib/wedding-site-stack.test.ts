import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WeddingSiteStack, type WeddingSiteStackProps } from './wedding-site-stack.js';

const webDistPath = path.resolve('apps/web/dist');
const webDistIndexPath = path.join(webDistPath, 'index.html');
let createdWebDistFixture = false;

function synthInviteCodePepper(envName: WeddingSiteStackProps['envName']) {
  const app = new cdk.App();
  const stack = new WeddingSiteStack(app, `WeddingSite-${envName}`, {
    env: { account: '123456789012', region: 'us-west-1' },
    envName,
    allowedOrigins: [],
    notificationRecipientEmails: [],
    enablePasskeys: false,
  });
  const template = Template.fromStack(stack).toJSON();
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

function synthStackTemplate(props: WeddingSiteStackProps) {
  const app = new cdk.App({
    context: {
      'hosted-zone:account=123456789012:domainName=matt-alison.com:region=us-west-1': {
        Id: 'Z1234567890',
        Name: 'matt-alison.com.',
      },
    },
  });
  const stack = new WeddingSiteStack(app, `WeddingSite-${props.envName}`, props);

  return Template.fromStack(stack).toJSON();
}

describe('WeddingSiteStack invite code pepper retention', () => {
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

  it('creates nested auth domains after the frontend alias record exists', () => {
    const template = synthStackTemplate({
      env: { account: '123456789012', region: 'us-west-1' },
      envName: 'staging',
      hostedZoneDomain: 'matt-alison.com',
      frontendDomainName: 'staging.matt-alison.com',
      authDomainName: 'login.staging.matt-alison.com',
      allowedOrigins: [],
      notificationRecipientEmails: [],
      enablePasskeys: true,
    });
    const resources = Object.entries(template.Resources) as Array<
      [
        string,
        {
          Type?: string;
          Properties?: {
            Name?: unknown;
          };
          DependsOn?: unknown;
        },
      ]
    >;
    const siteAliasRecordLogicalId = resources.find(
      ([, resource]) =>
        resource.Type === 'AWS::Route53::RecordSet' &&
        resource.Properties?.Name === 'staging.matt-alison.com.',
    )?.[0];
    const userPoolDomain = resources
      .map(([, resource]) => resource)
      .find((resource) => resource.Type === 'AWS::Cognito::UserPoolDomain');

    expect(siteAliasRecordLogicalId).toBeDefined();
    expect(userPoolDomain).toBeDefined();
    expect(userPoolDomain).toMatchObject({
      DependsOn: expect.arrayContaining([siteAliasRecordLogicalId]),
    });
  });
});
