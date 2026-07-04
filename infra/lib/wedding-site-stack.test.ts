import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EdgeObservabilityStack } from './edge-observability-stack.js';
import {
  WeddingSiteStack,
  type WeddingSiteStackProps,
} from './wedding-site-stack.js';

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
  const app = new cdk.App({
    context: {
      'hosted-zone:account=123456789012:domainName=matt-alison.com:region=us-west-1':
        {
          Id: 'Z1234567890',
          Name: 'matt-alison.com.',
        },
    },
  });
  const stack = new WeddingSiteStack(
    app,
    `WeddingSite-${props.envName}`,
    props,
  );
  return Template.fromStack(stack).toJSON();
}

function synthEdgeObservabilityTemplate(props: {
  envName: string;
  operationsAlertEmails?: string[];
}): Record<string, any> {
  const app = new cdk.App();
  const stack = new EdgeObservabilityStack(
    app,
    `WeddingSiteEdgeObservability-${props.envName}`,
    {
      env: { account: '123456789012', region: 'us-east-1' },
      envName: props.envName,
      distributionId: 'E1234567890ABC',
      operationsAlertEmails: props.operationsAlertEmails,
    },
  );
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

function dashboardBodyText(template: Record<string, any>): string {
  const dashboards = templateResourcesOfType(
    template,
    'AWS::CloudWatch::Dashboard',
  );
  expect(dashboards).toHaveLength(1);

  return JSON.stringify(dashboards[0].Properties?.DashboardBody);
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

    expect(
      templateResourcesOfType(template, 'AWS::SES::EmailIdentity'),
    ).toHaveLength(0);
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
    const sesIdentities = templateResourcesOfType(
      template,
      'AWS::SES::EmailIdentity',
    );

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

  it('synthesizes CloudFormation-compatible route setting keys', () => {
    const template = synthStackTemplate({
      env: { account: '123456789012', region: 'us-west-1' },
      envName: 'production',
      allowedOrigins: [],
      notificationRecipientEmails: [],
      enablePasskeys: false,
    });
    const stage = templateResourcesOfType(
      template,
      'AWS::ApiGatewayV2::Stage',
    ).find((resource) => resource.Properties?.RouteSettings);

    expect(stage).toBeDefined();
    expect(stage).toMatchObject({
      Properties: {
        RouteSettings: {
          'GET /api/rsvp/{inviteCode}': {
            ThrottlingBurstLimit: 20,
            ThrottlingRateLimit: 10,
          },
        },
      },
    });
    expect(JSON.stringify(stage)).not.toContain('throttlingBurstLimit');
  });

  it('creates a dashboard and baseline alarms without notification wiring by default', () => {
    const template = synthStackTemplate({
      env: { account: '123456789012', region: 'us-west-1' },
      envName: 'staging',
      allowedOrigins: [],
      notificationRecipientEmails: [],
      enablePasskeys: false,
    });
    const dashboardBody = dashboardBodyText(template);
    const alarms = templateResourcesOfType(template, 'AWS::CloudWatch::Alarm');

    expect(alarms).toHaveLength(6);
    expect(templateResourcesOfType(template, 'AWS::SNS::Topic')).toHaveLength(
      0,
    );
    expect(
      templateResourcesOfType(template, 'AWS::SNS::Subscription'),
    ).toHaveLength(0);
    expect(dashboardBody).toContain('Wedding Site staging Operations');
    expect(dashboardBody).toContain('API Gateway Traffic');
    expect(dashboardBody).toContain('API Lambda Health');
    expect(dashboardBody).toContain('DynamoDB Throttles');
    expect(dashboardBody).toContain('DynamoDB System Errors');
    expect(dashboardBody).toContain('CloudFront Error Rates');
    expect(dashboardBody).toContain('Recent API Errors');
    expect(dashboardBody).not.toContain('Contact Forwarder Lambda Health');
    expect(dashboardBody).not.toContain('WAF Public RSVP Requests');
  });

  it('wires configured operations alert emails to alarm actions', () => {
    const template = synthStackTemplate({
      env: { account: '123456789012', region: 'us-west-1' },
      envName: 'staging',
      allowedOrigins: [],
      notificationRecipientEmails: [],
      operationsAlertEmails: ['ops@example.com', 'ops2@example.com'],
      enablePasskeys: false,
    });
    const alarms = templateResourcesOfType(template, 'AWS::CloudWatch::Alarm');
    const subscriptions = templateResourcesOfType(
      template,
      'AWS::SNS::Subscription',
    );

    expect(templateResourcesOfType(template, 'AWS::SNS::Topic')).toHaveLength(
      1,
    );
    expect(subscriptions).toHaveLength(2);
    expect(
      subscriptions.map((subscription) => subscription.Properties.Endpoint),
    ).toEqual(expect.arrayContaining(['ops@example.com', 'ops2@example.com']));
    expect(alarms).toHaveLength(6);
    expect(
      alarms.every((alarm) => Array.isArray(alarm.Properties.AlarmActions)),
    ).toBe(true);
  });

  it('adds contact-forwarder dashboard widgets and alarms only when contact forwarding is configured', () => {
    const template = synthStackTemplate({
      env: { account: '123456789012', region: 'us-west-1' },
      envName: 'staging',
      allowedOrigins: [],
      hostedZoneDomain: 'matt-alison.com',
      frontendDomainName: 'staging.matt-alison.com',
      contactEmailAddress: 'contact@matt-alison.com',
      contactForwardingRecipientEmail: 'admin@example.com',
      notificationRecipientEmails: [],
      enablePasskeys: false,
    });
    const dashboardBody = dashboardBodyText(template);

    expect(
      templateResourcesOfType(template, 'AWS::CloudWatch::Alarm'),
    ).toHaveLength(8);
    expect(dashboardBody).toContain('Contact Forwarder Lambda Health');
    expect(dashboardBody).toContain('Recent Contact Forwarder Errors');
  });

  it('includes WAF widgets only for production stacks with a CloudFront web ACL', () => {
    const productionTemplate = synthStackTemplate({
      env: { account: '123456789012', region: 'us-west-1' },
      envName: 'production',
      allowedOrigins: [],
      cloudFrontWebAclArn:
        'arn:aws:wafv2:us-east-1:123456789012:global/webacl/wedding-site-production-public-rsvp/11111111-1111-1111-1111-111111111111',
      notificationRecipientEmails: [],
      enablePasskeys: false,
    });
    const stagingTemplate = synthStackTemplate({
      env: { account: '123456789012', region: 'us-west-1' },
      envName: 'staging',
      allowedOrigins: [],
      cloudFrontWebAclArn:
        'arn:aws:wafv2:us-east-1:123456789012:global/webacl/wedding-site-staging-public-rsvp/11111111-1111-1111-1111-111111111111',
      notificationRecipientEmails: [],
      enablePasskeys: false,
    });

    expect(dashboardBodyText(productionTemplate)).toContain(
      'WAF Public RSVP Requests',
    );
    expect(dashboardBodyText(productionTemplate)).toContain('publicRsvpWebAcl');
    expect(dashboardBodyText(stagingTemplate)).not.toContain(
      'WAF Public RSVP Requests',
    );
  });

  it('creates the edge CloudFront 5xx alarm in us-east-1 without notification wiring by default', () => {
    const template = synthEdgeObservabilityTemplate({ envName: 'staging' });
    const alarms = templateResourcesOfType(template, 'AWS::CloudWatch::Alarm');

    expect(alarms).toHaveLength(1);
    expect(alarms[0]).toMatchObject({
      Properties: {
        AlarmName: 'wedding-site-staging-cloudfront-5xx-error-rate',
        Metrics: [
          expect.objectContaining({
            MetricStat: {
              Metric: {
                MetricName: '5xxErrorRate',
                Namespace: 'AWS/CloudFront',
                Dimensions: expect.arrayContaining([
                  { Name: 'DistributionId', Value: 'E1234567890ABC' },
                  { Name: 'Region', Value: 'Global' },
                ]),
              },
              Period: 300,
              Stat: 'Average',
            },
          }),
        ],
      },
    });
    expect(templateResourcesOfType(template, 'AWS::SNS::Topic')).toHaveLength(
      0,
    );
    expect(
      templateResourcesOfType(template, 'AWS::SNS::Subscription'),
    ).toHaveLength(0);
  });

  it('wires edge CloudFront alarm notifications when operations emails are configured', () => {
    const template = synthEdgeObservabilityTemplate({
      envName: 'production',
      operationsAlertEmails: ['ops@example.com'],
    });
    const alarms = templateResourcesOfType(template, 'AWS::CloudWatch::Alarm');
    const subscriptions = templateResourcesOfType(
      template,
      'AWS::SNS::Subscription',
    );

    expect(templateResourcesOfType(template, 'AWS::SNS::Topic')).toHaveLength(
      1,
    );
    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0].Properties.Endpoint).toBe('ops@example.com');
    expect(alarms[0].Properties.AlarmActions).toBeDefined();
  });
});
