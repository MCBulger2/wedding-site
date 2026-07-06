import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('app route code splitting', () => {
  it('keeps the admin dashboard out of the initial route bundle', () => {
    const appSource = readFileSync(
      new URL('../src/App.tsx', import.meta.url),
      'utf8',
    );

    expect(appSource).not.toMatch(
      /import\s+\{[^}]*\bAdminPage\b[^}]*\}\s+from\s+['"]\.\/pages\/AdminPage\.js['"]/,
    );
    expect(appSource).toContain("import('./pages/AdminPage.js')");
  });

  it('keeps the RSVP flow out of the initial route bundle', () => {
    const appSource = readFileSync(
      new URL('../src/App.tsx', import.meta.url),
      'utf8',
    );

    expect(appSource).not.toMatch(
      /import\s+\{[^}]*\bRsvp(?:Lookup)?Page\b[^}]*\}\s+from\s+['"]\.\/pages\/RsvpPages\.js['"]/,
    );
    expect(appSource).toContain("import('./pages/RsvpPages.js')");
  });
});
