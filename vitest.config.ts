import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: [
      'apps/api/src/**/*.test.ts',
      'apps/web/src/**/*.test.{ts,tsx}',
      'infra/**/*.test.ts',
      'packages/shared/src/**/*.test.ts',
    ],
  },
  resolve: {
    alias: {
      '@matt-alison-wedding/shared': new URL('./packages/shared/src/index.ts', import.meta.url).pathname,
    },
  },
});
