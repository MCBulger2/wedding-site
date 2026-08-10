import { describe, expect, it } from 'vitest';

describe('Vite production build config', () => {
  it('uses explicit minification without deployed source maps', async () => {
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

    expect(config.build?.minify).toBe('esbuild');
    expect(config.build?.cssMinify).toBe('esbuild');
    expect(config.build?.sourcemap).toBe(false);
  });
});
