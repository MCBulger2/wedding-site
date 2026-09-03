import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

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

  it('writes the shared wedding calendar file to the production output', async () => {
    const { default: viteConfig } = await import('../vite.config.ts');
    const config = await viteConfig({
      command: 'build',
      mode: 'production',
      isSsrBuild: false,
      isPreview: false,
    });
    const outputPath = resolve('apps/web/dist/matt-alison-wedding.ics');
    const calendarPlugin = config.plugins.find(
      (plugin) => plugin?.name === 'wedding-calendar',
    );

    rmSync(outputPath, { force: true });
    await calendarPlugin?.closeBundle?.();

    expect(existsSync(outputPath)).toBe(true);
    expect(readFileSync(outputPath, 'utf8')).toContain(
      'DTSTART;TZID=America/Phoenix:20270117T163000',
    );
  });
});
