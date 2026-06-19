import { spawnSync } from 'node:child_process';

const defaultApiDomainNames = {
  staging: 'api.staging.example.com',
  production: 'api.example.com',
};

const envName = process.argv[2];

if (!envName) {
  console.error('Usage: node scripts/build-for-env.mjs <environment>');
  process.exit(1);
}

const apiDomainName = process.env.API_DOMAIN_NAME?.trim() || defaultApiDomainNames[envName];
if (!apiDomainName) {
  console.error(`Unknown deployment environment: ${envName}`);
  process.exit(1);
}

const viteApiBaseUrl = `https://${apiDomainName}/api`;

const npmExecPath = process.env.npm_execpath;
if (!npmExecPath) {
  console.error('npm_execpath is not available in the current environment.');
  process.exit(1);
}

const buildResult = spawnSync(process.execPath, [npmExecPath, 'run', 'build', '--workspaces', '--if-present'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ENV_NAME: envName,
    VITE_API_BASE_URL: viteApiBaseUrl,
  },
});

if (buildResult.error) {
  console.error(buildResult.error.message);
  process.exit(1);
}

if (buildResult.status !== 0) {
  process.exit(buildResult.status ?? 1);
}
