import { describe, expect, test } from 'vitest';

import { buildSummaryMarkdown } from './report-github-test-results.mjs';

describe('buildSummaryMarkdown', () => {
  test('summarizes junit test totals and coverage totals', () => {
    const summary = buildSummaryMarkdown({
      reports: [
        {
          label: 'Unit tests',
          xml: '<testsuites tests="155" failures="0" errors="0" skipped="2" time="20.5"></testsuites>',
        },
        {
          label: 'E2E tests',
          xml: '<testsuites><testsuite tests="12" failures="1" errors="0" skipped="0" time="8.25"></testsuite></testsuites>',
        },
      ],
      coverageSummary: {
        total: {
          lines: { pct: 54.04, covered: 1495, total: 2766 },
          statements: { pct: 53.94, covered: 1519, total: 2816 },
          branches: { pct: 47.8, covered: 980, total: 2050 },
          functions: { pct: 48.16, covered: 355, total: 737 },
        },
      },
    });

    expect(summary).toContain('| Unit tests | 155 | 0 | 0 | 2 | 20.50s |');
    expect(summary).toContain('| E2E tests | 12 | 1 | 0 | 0 | 8.25s |');
    expect(summary).toContain('| Lines | 54.04% | 1495 / 2766 |');
    expect(summary).toContain('| Branches | 47.80% | 980 / 2050 |');
  });
});
