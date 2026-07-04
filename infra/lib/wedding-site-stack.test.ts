import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IConstruct } from 'constructs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CertificateStack } from './certificate-stack.js';
import { EdgeObservabilityStack } from './edge-observability-stack.js';
import {
  WeddingSiteStack,
  type WeddingSiteStackProps,
} from './wedding-site-stack.js';

const webDistPath = path.resolve('apps/web/dist');
const webDistIndexPath = path.join(webDistPath, 'index.html');
let createdWebDistFixture = false;

function resourceTagsForEnv(envName: string): Record<string, string> {
  return {
    Project: 'Wedding Site',
    Environment: envName === 'production' ? 'Production' : 'Staging',
  };
}

function applyResourceTags(stack: cdk.Stack, envName: string): void {
  const tags = resourceTagsForEnv(envName);
  for (const [key, value] of Object.entries(tags)) {
    cdk.Tags.of(stack).add(key, value);
  }
  cdk.Aspects.of(stack).add(new LambdaFunctionTagAspect(tags));
}

class LambdaFunctionTagAspect implements cdk.IAspect {
  constructor(private readonly tags: Record<string, string>) {}

  visit(node: IConstruct): void {
    if (
      !cdk.CfnResource.isCfnResource(node) ||
      node.cfnResourceType !== 'AWS::Lambda::Function'
    ) {
      return;
    }

    const tagManager = (node as unknown as { tags?: cdk.TagManager }).tags;
    if (tagManager) {
      for (const [key, value] of Object.entries(this.tags)) {
        tagManager.setTag(key, value);
      }
      return;
    }

    node.addPropertyOverride(
      'Tags',
      Object.entries(this.tags).map(([Key, Value]) => ({ Key, Value })),
    );
  }
}

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

type TestWeddingSiteStackProps = Omit<
  WeddingSiteStackProps,
  'enableLocalBrowserTrust'
> & {
  enableLocalBrowserTrust?: boolean;
};

function synthStackTemplate(
  props: TestWeddingSiteStackProps,
): Record<string, any> {
  const app = new cdk.App({
    context: {
      'hosted-zone:account=123456789012:domainName=matt-alison.com:region=us-west-1':
        {
          Id: 'Z1234567890',
          Name: 'matt-alison.com.',
        },
      'hosted-zone:account=123456789012:domainName=matt-alison.com:region=us-east-1':
        {
          Id: 'Z1234567890',
          Name: 'matt-alison.com.',
        },
    },
  });
  const { enableLocalBrowserTrust, ...stackProps } = props;
  const stack = new WeddingSiteStack(app, `WeddingSite-${props.envName}`, {
    enableLocalBrowserTrust:
      enableLocalBrowserTrust ?? props.envName !== 'production',
    ...(stackProps as Omit<WeddingSiteStackProps, 'enableLocalBrowserTrust'>),
    tags: {
      ...resourceTagsForEnv(props.envName),
      ...props.tags,
    },
  });
  applyResourceTags(stack, props.envName);
  return Template.fromStack(stack).toJSON();
}

function synthCertificateTemplate(props: {
  envName: string;
  hostedZoneDomain?: string;
  frontendDomainName?: string;
  authDomainName?: string;
}): Record<string, any> {
  const app = new cdk.App({
    context: {
      'hosted-zone:account=123456789012:domainName=matt-alison.com:region=us-east-1':
        {
          Id: 'Z1234567890',
          Name: 'matt-alison.com.',
        },
    },
  });
  const stack = new CertificateStack(
    app,
    `WeddingSiteCertificates-${props.envName}`,
    {
      env: { account: '123456789012', region: 'us-east-1' },
      tags: resourceTagsForEnv(props.envName),
      ...props,
    },
  );
  applyResourceTags(stack, props.envName);
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
      tags: resourceTagsForEnv(props.envName),
      envName: props.envName,
      distributionId: 'E1234567890ABC',
      operationsAlertEmails: props.operationsAlertEmails,
    },
  );
  applyResourceTags(stack, props.envName);
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

type SynthesizedResource = {
  Type?: string;
  Properties?: Record<string, any>;
  DeletionPolicy?: string;
  UpdateReplacePolicy?: string;
};

function templateResourceEntries(
  template: Record<string, any>,
): Array<[string, SynthesizedResource]> {
  return Object.entries(
    template.Resources as Record<string, SynthesizedResource>,
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

function httpApiResource(template: Record<string, any>): SynthesizedResource {
  const api = templateResourcesOfType(template, 'AWS::ApiGatewayV2::Api').find(
    (resource) => resource.Properties?.ProtocolType === 'HTTP',
  );
  expect(api).toBeDefined();
  return api as SynthesizedResource;
}

function userPoolClientResource(
  template: Record<string, any>,
): SynthesizedResource {
  const userPoolClient = templateResourcesOfType(
    template,
    'AWS::Cognito::UserPoolClient',
  ).find((resource) =>
    Array.isArray(resource.Properties?.AllowedOAuthFlows)
      ? resource.Properties.AllowedOAuthFlows.includes('code')
      : false,
  );
  expect(userPoolClient).toBeDefined();
  return userPoolClient as SynthesizedResource;
}

function expectTaggedResourceTypes(
  template: Record<string, any>,
  resourceTypes: string[],
  envName: string,
): void {
  for (const resourceType of resourceTypes) {
    const resources = templateResourcesOfType(template, resourceType);
    expect(resources.length, resourceType).toBeGreaterThan(0);
    for (const resource of resources) {
      expect(resource.Properties?.Tags, resourceType).toEqual(
        expect.arrayContaining([
          { Key: 'Project', Value: 'Wedding Site' },
          {
            Key: 'Environment',
            Value: envName === 'production' ? 'Production' : 'Staging',
          },
        ]),
      );
    }
  }
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

  it('tags core site stack resources with project and environment values', () => {
    for (const envName of ['staging', 'production']) {
      const template = synthStackTemplate({
        env: { account: '123456789012', region: 'us-west-1' },
        envName,
        allowedOrigins: [],
        notificationRecipientEmails: [],
        enablePasskeys: false,
      });

      expectTaggedResourceTypes(
        template,
        [
          'AWS::DynamoDB::Table',
          'AWS::KMS::Key',
          'AWS::Lambda::Function',
          'AWS::S3::Bucket',
          'AWS::SecretsManager::Secret',
        ],
        envName,
      );
    }
  });

  it('tags certificate stack resources with project and environment values', () => {
    const stagingTemplate = synthCertificateTemplate({
      envName: 'staging',
      hostedZoneDomain: 'matt-alison.com',
      frontendDomainName: 'staging.matt-alison.com',
      authDomainName: 'login.staging.matt-alison.com',
    });
    const productionTemplate = synthCertificateTemplate({
      envName: 'production',
      hostedZoneDomain: 'matt-alison.com',
      frontendDomainName: 'matt-alison.com',
      authDomainName: 'login.matt-alison.com',
    });

    expectTaggedResourceTypes(
      stagingTemplate,
      ['AWS::CertificateManager::Certificate'],
      'staging',
    );
    expectTaggedResourceTypes(
      productionTemplate,
      ['AWS::CertificateManager::Certificate', 'AWS::WAFv2::WebACL'],
      'production',
    );
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

  it('defaults production CORS to the deployed frontend origin only', () => {
    const template = synthStackTemplate({
      env: { account: '123456789012', region: 'us-west-1' },
      envName: 'production',
      frontendDomainName: 'matt-alison.com',
      allowedOrigins: [],
      notificationRecipientEmails: [],
      enablePasskeys: false,
    });

    expect(
      httpApiResource(template).Properties?.CorsConfiguration,
    ).toMatchObject({
      AllowOrigins: ['https://matt-alison.com'],
    });
  });

  it('omits production API CORS when no trusted browser origins are available', () => {
    const template = synthStackTemplate({
      env: { account: '123456789012', region: 'us-west-1' },
      envName: 'production',
      allowedOrigins: [],
      notificationRecipientEmails: [],
      enablePasskeys: false,
    });

    expect(
      httpApiResource(template).Properties?.CorsConfiguration,
    ).toBeUndefined();
  });

  it('keeps production admin redirects on the custom deployed frontend only', () => {
    const template = synthStackTemplate({
      env: { account: '123456789012', region: 'us-west-1' },
      envName: 'production',
      frontendDomainName: 'matt-alison.com',
      allowedOrigins: [],
      notificationRecipientEmails: [],
      enablePasskeys: false,
    });

    expect(userPoolClientResource(template).Properties).toMatchObject({
      CallbackURLs: ['https://matt-alison.com/admin'],
      LogoutURLs: ['https://matt-alison.com/admin'],
    });
  });

  it('keeps staging local browser trust for CORS and admin redirects', () => {
    const template = synthStackTemplate({
      env: { account: '123456789012', region: 'us-west-1' },
      envName: 'staging',
      frontendDomainName: 'staging.matt-alison.com',
      allowedOrigins: [],
      notificationRecipientEmails: [],
      enablePasskeys: false,
      enableLocalBrowserTrust: true,
    });
    const corsConfig = httpApiResource(template).Properties?.CorsConfiguration;
    const userPoolClient = userPoolClientResource(template).Properties;

    expect(corsConfig).toMatchObject({
      AllowOrigins: expect.arrayContaining([
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'https://staging.matt-alison.com',
      ]),
    });
    expect(userPoolClient?.CallbackURLs).toEqual(
      expect.arrayContaining([
        'http://localhost:5173/admin',
        'http://127.0.0.1:5173/admin',
        'https://staging.matt-alison.com/admin',
      ]),
    );
    expect(userPoolClient?.CallbackURLs).toHaveLength(4);
    expect(userPoolClient?.LogoutURLs).toEqual(userPoolClient?.CallbackURLs);
  });

  it('rejects local configured origins in production without explicit local browser trust', () => {
    expect(() =>
      synthStackTemplate({
        env: { account: '123456789012', region: 'us-west-1' },
        envName: 'production',
        frontendDomainName: 'matt-alison.com',
        allowedOrigins: ['http://localhost:5173'],
        notificationRecipientEmails: [],
        enablePasskeys: false,
      }),
    ).toThrow(/localhost|127\.0\.0\.1/i);
  });

  it('permits local configured origins and redirects when explicit local browser trust is enabled', () => {
    const template = synthStackTemplate({
      env: { account: '123456789012', region: 'us-west-1' },
      envName: 'production',
      frontendDomainName: 'matt-alison.com',
      allowedOrigins: ['http://localhost:4173'],
      notificationRecipientEmails: [],
      enablePasskeys: false,
      enableLocalBrowserTrust: true,
    });
    const corsConfig = httpApiResource(template).Properties?.CorsConfiguration;
    const userPoolClient = userPoolClientResource(template).Properties;

    expect(corsConfig?.AllowOrigins).toEqual(
      expect.arrayContaining([
        'http://localhost:4173',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'https://matt-alison.com',
      ]),
    );
    expect(userPoolClient?.CallbackURLs).toEqual(
      expect.arrayContaining([
        'http://localhost:5173/admin',
        'http://127.0.0.1:5173/admin',
        'https://matt-alison.com/admin',
      ]),
    );
    expect(userPoolClient?.CallbackURLs).toHaveLength(4);
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
      enableLocalBrowserTrust: true,
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

  it('creates a one-month API access log group with safe stage access logs', () => {
    const template = synthStackTemplate({
      env: { account: '123456789012', region: 'us-west-1' },
      envName: 'staging',
      allowedOrigins: [],
      notificationRecipientEmails: [],
      enablePasskeys: false,
    });
    const apiAccessLogGroupEntry = templateResourceEntries(template).find(
      ([logicalId, resource]) =>
        logicalId.includes('ApiAccessLogGroup') &&
        resource.Type === 'AWS::Logs::LogGroup',
    );
    const apiHandlerLogGroupEntry = templateResourceEntries(template).find(
      ([logicalId, resource]) =>
        logicalId.includes('ApiHandlerLogGroup') &&
        resource.Type === 'AWS::Logs::LogGroup',
    );
    const stage = templateResourcesOfType(
      template,
      'AWS::ApiGatewayV2::Stage',
    ).find((resource) => resource.Properties?.AccessLogSettings);

    expect(apiAccessLogGroupEntry).toBeDefined();
    expect(apiAccessLogGroupEntry?.[1]).toMatchObject({
      Properties: {
        RetentionInDays: 30,
      },
    });
    expect(apiHandlerLogGroupEntry).toBeDefined();
    expect(apiAccessLogGroupEntry?.[1].DeletionPolicy).toBe(
      apiHandlerLogGroupEntry?.[1].DeletionPolicy,
    );
    expect(apiAccessLogGroupEntry?.[1].UpdateReplacePolicy).toBe(
      apiHandlerLogGroupEntry?.[1].UpdateReplacePolicy,
    );
    expect(stage).toBeDefined();
    expect(stage?.Properties?.AccessLogSettings).toMatchObject({
      Format:
        '{"requestId":"$context.requestId","routeKey":"$context.routeKey","status":"$context.status","responseLatency":"$context.responseLatency","integrationLatency":"$context.integrationLatency","protocol":"$context.protocol","responseLength":"$context.responseLength"}',
    });
    expect(stage?.Properties?.AccessLogSettings?.DestinationArn).toEqual({
      'Fn::GetAtt': [apiAccessLogGroupEntry?.[0], 'Arn'],
    });
    expect(stage?.Properties?.AccessLogSettings?.Format).toContain('routeKey');
    expect(stage?.Properties?.AccessLogSettings?.Format).toContain(
      'responseLatency',
    );
    expect(stage?.Properties?.AccessLogSettings?.Format).not.toContain(
      'rawPath',
    );
    expect(stage?.Properties?.AccessLogSettings?.Format).not.toContain(
      'queryString',
    );
    expect(stage?.Properties?.AccessLogSettings?.Format).not.toContain(
      'headers',
    );
    expect(stage?.Properties?.AccessLogSettings?.Format).not.toContain(
      'sourceIp',
    );
    expect(stage?.Properties?.AccessLogSettings?.Format).not.toContain('body');
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
    expect(dashboardBody).toContain('API Request Timeline');
    expect(dashboardBody).not.toContain('sort bin(5m)');
    expect(dashboardBody).toContain('Recent API Application Events');
    expect(dashboardBody).toContain('Public RSVP And Recovery Activity');
    expect(dashboardBody).toContain('Admin Activity');
    expect(dashboardBody).toContain('Notification Delivery');
    expect(dashboardBody).toContain('DynamoDB Throttles');
    expect(dashboardBody).toContain('DynamoDB System Errors');
    expect(dashboardBody).toContain('CloudFront Error Rates');
    expect(dashboardBody).toContain('Recent API Errors');
    expect(dashboardBody).not.toContain('Contact Forwarder Lambda Health');
    expect(dashboardBody).not.toContain('Contact Forwarding Activity');
    expect(dashboardBody).not.toContain('Recent Contact Forwarder Errors');
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
    expect(dashboardBody).toContain('Contact Forwarding Activity');
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

  it('tags edge observability resources with project and environment values', () => {
    const template = synthEdgeObservabilityTemplate({
      envName: 'production',
      operationsAlertEmails: ['ops@example.com'],
    });

    expectTaggedResourceTypes(
      template,
      ['AWS::CloudWatch::Alarm', 'AWS::SNS::Topic'],
      'production',
    );
  });
});
