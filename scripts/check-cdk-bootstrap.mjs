import { execFileSync } from 'node:child_process';

const qualifier = process.env.CDK_BOOTSTRAP_QUALIFIER?.trim() || 'hnb659fds';
const bootstrapVersionParameter = `/cdk-bootstrap/${qualifier}/version`;
const appRegion = process.env.APP_REGION?.trim() || process.env.AWS_REGION?.trim() || 'us-west-1';
const requiredRegions = [...new Set([appRegion, 'us-east-1'])];

let accountId;

try {
  accountId = runAws(['sts', 'get-caller-identity', '--query', 'Account', '--output', 'text']);
} catch (error) {
  console.error('Unable to resolve the current AWS account with `aws sts get-caller-identity`.');
  console.error(formatAwsError(error));
  process.exit(1);
}

const missingRegions = [];

for (const region of requiredRegions) {
  try {
    runAws([
      'ssm',
      'get-parameter',
      '--name',
      bootstrapVersionParameter,
      '--region',
      region,
      '--query',
      'Parameter.Value',
      '--output',
      'text',
    ]);
  } catch {
    missingRegions.push(region);
  }
}

if (missingRegions.length > 0) {
  const environments = missingRegions.map((region) => `aws://${accountId}/${region}`).join(' ');

  console.error(`CDK bootstrap is missing or inaccessible in: ${missingRegions.join(', ')}`);
  console.error('Run this once with credentials allowed to create CDK bootstrap resources:');
  console.error(`npm run bootstrap:infra -- ${environments}`);
  process.exit(1);
}

console.log(`CDK bootstrap found for account ${accountId} in ${requiredRegions.join(', ')}.`);

function runAws(args) {
  return execFileSync('aws', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function formatAwsError(error) {
  const stderr = error?.stderr?.toString().trim();
  return stderr || error?.message || String(error);
}
