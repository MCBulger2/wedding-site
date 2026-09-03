import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { generateIcs, siteContent } from '../../packages/shared/src/index.js';

const appRoot = fileURLToPath(new URL('.', import.meta.url));
const calendarPath = join(appRoot, 'dist', 'matt-alison-wedding.ics');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, appRoot, '');
  const localApiProxyTarget = env.LOCAL_API_PROXY_TARGET?.trim();

  return {
    plugins: [
      react(),
      {
        name: 'wedding-calendar',
        closeBundle() {
          mkdirSync(dirname(calendarPath), { recursive: true });
          writeFileSync(calendarPath, generateIcs(siteContent.weddingEvent));
        },
      },
    ],
    build: {
      cssMinify: 'esbuild',
      minify: 'esbuild',
      sourcemap: false,
    },
    resolve: {
      alias: {
        '@matt-alison-wedding/shared': fileURLToPath(
          new URL('../../packages/shared/src/index.ts', import.meta.url),
        ),
      },
    },
    server: localApiProxyTarget
      ? {
          proxy: {
            '/api': {
              target: localApiProxyTarget,
              changeOrigin: true,
            },
          },
        }
      : undefined,
  };
});
