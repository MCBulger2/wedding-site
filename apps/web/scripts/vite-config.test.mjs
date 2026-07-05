import { describe, expect, it } from 'vitest';

describe('Vite production build config', () => {
  it('emits source maps for deployed JavaScript bundles', async () => {
    const { default: viteConfig } = await import('../vite.config.ts');
    const config =
      typeof viteConfig === 'function'
        ? await viteConfig({
            command: 'build',
            mode: 'production',
            isSsrBuild: false,
            isPreview: false,
          })
        : viteConfig;

    expect(config.build?.sourcemap).toBe(true);
  });
});
