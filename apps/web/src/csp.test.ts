import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('frontend CSP compatibility', () => {
  it('keeps the document free of inline scripts', () => {
    const html = readFileSync(resolve('apps/web/index.html'), 'utf8');
    const scriptTags = [
      ...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi),
    ];
    const inlineScripts = scriptTags.filter(([, attributes, body]) => {
      return !/\bsrc\s*=/.test(attributes) && body.trim().length > 0;
    });

    expect(inlineScripts).toHaveLength(0);
  });
});
