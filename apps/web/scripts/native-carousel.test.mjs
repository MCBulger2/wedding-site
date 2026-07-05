import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('native photo carousel', () => {
  it('does not ship Embla for the homepage carousel', () => {
    const webPackage = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    );
    const publicPagesSource = readFileSync(
      new URL('../src/pages/PublicPages.tsx', import.meta.url),
      'utf8',
    );

    expect(webPackage.dependencies).not.toHaveProperty('embla-carousel-react');
    expect(publicPagesSource).not.toContain('embla-carousel-react');
    expect(publicPagesSource).not.toContain('useEmblaCarousel');
  });
});
