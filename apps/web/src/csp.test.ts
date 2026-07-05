import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

describe('frontend CSP compatibility', () => {
  it('keeps the document free of inline scripts', () => {
    const html = readFileSync(resolve('apps/web/index.html'), 'utf8');
    const dom = new JSDOM(html);
    const scripts = [...dom.window.document.querySelectorAll('script')];
    const inlineScripts = scripts.filter((script) => {
      return !script.hasAttribute('src') && (script.textContent ?? '').trim().length > 0;
    });

    expect(inlineScripts).toHaveLength(0);
  });
});
