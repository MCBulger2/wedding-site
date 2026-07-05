import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom') as {
  JSDOM: new (html: string) => { window: { document: Document } };
};

describe('index.html LCP image preload', () => {
  it('makes the hero image discoverable in the initial document with high priority', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const document = new JSDOM(html).window.document;
    const preload = document.querySelector(
      'link[rel="preload"][as="image"][href="/images/hero-wedding-960.avif"]',
    );

    expect(preload).not.toBeNull();
    expect(preload?.getAttribute('type')).toBe('image/avif');
    expect(preload?.getAttribute('imagesrcset')).toBe(
      '/images/hero-wedding-960.avif 1x, /images/hero-wedding-1920.avif 2x',
    );
    expect(preload?.getAttribute('fetchpriority')).toBe('high');
    expect(preload?.hasAttribute('loading')).toBe(false);
  });
});
