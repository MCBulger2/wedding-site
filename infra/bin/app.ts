import 'source-map-support/register.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cdk from 'aws-cdk-lib';
import { deploymentConfigs } from '../config/deployment-config.js';
import { CertificateStack } from '../lib/certificate-stack.js';
import { WeddingSiteStack } from '../lib/wedding-site-stack.js';

const app = new cdk.App();

const envName = readString(app.node.tryGetContext('envName')) ?? process.env.ENV_NAME ?? 'staging';
loadEnvFiles(envName);

const deploymentConfig = deploymentConfigs[envName];
if (!deploymentConfig) {
  throw new Error(`Unknown deployment environment: ${envName}`);
}

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

const certificateStack =
  hostedZoneDomain && (frontendDomainName || authDomainName)
    ? new CertificateStack(app, `WeddingSiteCertificates-${envName}`, {
        env: { account, region: 'us-east-1' },
        crossRegionReferences: true,
        hostedZoneDomain,
        frontendDomainName,
        authDomainName,
      })
    : undefined;

new WeddingSiteStack(app, `WeddingSite-${envName}`, {
  env: { account, region: appRegion },
  crossRegionReferences: true,
  envName,
  domainName,
  frontendDomainName,
  apiDomainName,
  authDomainName,
  frontendCertificate: certificateStack?.frontendCertificate,
  authCertificate: certificateStack?.authCertificate,
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

function loadEnvFiles(envName: string): void {
  const protectedKeys = new Set(Object.keys(process.env));
  const loadedEnv: Record<string, string> = {};
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

  for (const fileName of ['.env', '.env.local', `.env.${envName}`, `.env.${envName}.local`]) {
    const filePath = path.join(repoRoot, fileName);
    if (!fs.existsSync(filePath)) {
      continue;
    }

    Object.assign(loadedEnv, parseEnvFile(fs.readFileSync(filePath, 'utf8'), fileName));
  }

  for (const [key, value] of Object.entries(loadedEnv)) {
    if (!protectedKeys.has(key)) {
      process.env[key] = value;
    }
  }
}

function parseEnvFile(contents: string, fileName: string): Record<string, string> {
  const values: Record<string, string> = {};
  const lines = contents.split(/\r?\n/);

  lines.forEach((line, index) => {
    const parsed = parseEnvLine(line);
    if (!parsed) {
      return;
    }

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(parsed.key)) {
      throw new Error(`${fileName}:${index + 1} has an invalid environment variable name: ${parsed.key}`);
    }

    values[parsed.key] = parsed.value;
  });

  return values;
}

function parseEnvLine(line: string): { key: string; value: string } | undefined {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return undefined;
  }

  const normalized = trimmed.startsWith('export ') ? trimmed.slice(7).trimStart() : trimmed;
  const separatorIndex = normalized.indexOf('=');
  if (separatorIndex === -1) {
    return undefined;
  }

  return {
    key: normalized.slice(0, separatorIndex).trim(),
    value: parseEnvValue(normalized.slice(separatorIndex + 1).trim()),
  };
}

function parseEnvValue(rawValue: string): string {
  if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
    return rawValue.slice(1, -1).replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }

  if (rawValue.startsWith("'") && rawValue.endsWith("'")) {
    return rawValue.slice(1, -1);
  }

  return stripInlineComment(rawValue).trim();
}

function stripInlineComment(value: string): string {
  const commentIndex = value.search(/\s#/);
  return commentIndex === -1 ? value : value.slice(0, commentIndex);
}
