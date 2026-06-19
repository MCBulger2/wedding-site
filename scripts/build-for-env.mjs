import { spawnSync } from 'node:child_process';
import { loadEnvFiles } from './load-env.mjs';

const envName = process.argv[2];

if (!envName) {
  console.error('Usage: node scripts/build-for-env.mjs <environment>');
  process.exit(1);
}

loadEnvFiles(envName);

const apiDomainName = process.env.API_DOMAIN_NAME?.trim();
const viteApiBaseUrl = apiDomainName ? `https://${apiDomainName}/api` : process.env.VITE_API_BASE_URL?.trim() || '/api';

const npmExecPath = process.env.npm_execpath;
if (!npmExecPath) {
  console.error('npm_execpath is not available in the current environment.');
  process.exit(1);
}

console.log(`Building ${envName} frontend with VITE_API_BASE_URL=${viteApiBaseUrl}`);

const buildResult = spawnSync(process.execPath, [npmExecPath, 'run', 'build'], {
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
