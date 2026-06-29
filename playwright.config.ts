import { defineConfig, devices } from '@playwright/test';

const e2ePort = process.env.E2E_PORT ?? '5173';
const baseURL = `http://127.0.0.1:${e2ePort}`;

export default defineConfig({
  testDir: './apps/web/e2e',
  webServer: {
    command: `npm run dev -w apps/web -- --host 127.0.0.1 --port ${e2ePort}`,
    env: {
      ...process.env,
      VITE_ENABLE_LOCAL_ADMIN_MOCKS: 'false',
    },
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
