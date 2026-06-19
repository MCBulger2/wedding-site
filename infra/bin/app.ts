import 'source-map-support/register.js';
import * as cdk from 'aws-cdk-lib';
import { deploymentConfigs } from '../config/deployment-config.js';
import { WeddingSiteStack } from '../lib/wedding-site-stack.js';

const app = new cdk.App();

const envName = readString(app.node.tryGetContext('envName')) ?? process.env.ENV_NAME ?? 'staging';
const deploymentConfig = deploymentConfigs[envName] ?? deploymentConfigs.staging;
const appRegion =
  readString(app.node.tryGetContext('appRegion')) ??
  process.env.APP_REGION ??
  process.env.AWS_REGION ??
  deploymentConfig.appRegion ??
  process.env.CDK_DEFAULT_REGION;
const account = process.env.CDK_DEFAULT_ACCOUNT;
const domainName = readString(app.node.tryGetContext('domainName')) ?? readString(process.env.DOMAIN_NAME);
const frontendDomainName =
  readString(app.node.tryGetContext('frontendDomainName')) ??
  readString(process.env.FRONTEND_DOMAIN_NAME) ??
  domainName ??
  deploymentConfig.frontendDomainName;
const apiDomainName =
  readString(app.node.tryGetContext('apiDomainName')) ??
  readString(process.env.API_DOMAIN_NAME) ??
  deploymentConfig.apiDomainName;
const authDomainName =
  readString(app.node.tryGetContext('authDomainName')) ??
  readString(process.env.AUTH_DOMAIN_NAME) ??
  deploymentConfig.authDomainName;
const hostedZoneDomain =
  readString(app.node.tryGetContext('hostedZoneDomain')) ??
  readString(process.env.HOSTED_ZONE_DOMAIN) ??
  domainName ??
  deploymentConfig.hostedZoneDomain;
const allowedOrigins =
  parseStringList(app.node.tryGetContext('allowedOrigins')) ??
  parseStringList(process.env.ALLOWED_ORIGINS) ??
  deploymentConfig.allowedOrigins;
const notificationSenderEmail =
  readString(app.node.tryGetContext('notificationSenderEmail')) ??
  readString(process.env.NOTIFICATION_SENDER_EMAIL) ??
  deploymentConfig.notificationSenderEmail;
const notificationRecipientEmails =
  parseStringList(app.node.tryGetContext('notificationRecipientEmails')) ??
  parseStringList(process.env.NOTIFICATION_RECIPIENT_EMAILS) ??
  deploymentConfig.notificationRecipientEmails;
const enablePasskeys =
  parseBoolean(app.node.tryGetContext('enablePasskeys')) ??
  parseBoolean(process.env.ENABLE_PASSKEYS) ??
  deploymentConfig.enablePasskeys;

new WeddingSiteStack(app, `WeddingSite-${envName}`, {
  env: { account, region: appRegion },
  envName,
  domainName,
  frontendDomainName,
  apiDomainName,
  authDomainName,
  hostedZoneDomain,
  allowedOrigins,
  notificationSenderEmail,
  notificationRecipientEmails,
  enablePasskeys,
});

function readString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseStringList(value: unknown): string[] | undefined {
  const text = readString(value);
  if (!text) {
    return undefined;
  }

  const items = text
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return items.length > 0 ? items : undefined;
}

function parseBoolean(value: unknown): boolean | undefined {
  const text = readString(value)?.toLowerCase();
  if (!text) {
    return undefined;
  }

  if (text === 'true') {
    return true;
  }

  if (text === 'false') {
    return false;
  }

  return undefined;
}
