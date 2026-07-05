import { fileURLToPath, URL } from 'node:url';

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const appRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, appRoot, '');
  const localApiProxyTarget = env.LOCAL_API_PROXY_TARGET?.trim();

  return {
    plugins: [react()],
    build: {
      sourcemap: true,
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
