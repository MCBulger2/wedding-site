import { existsSync, readFileSync, appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const defaultJunitReports = [
  { label: 'Unit tests', path: 'reports/vitest-junit.xml' },
  { label: 'E2E tests', path: 'reports/playwright-junit.xml' },
];
const defaultCoveragePath = 'coverage/coverage-summary.json';

function getAttributes(tag) {
  const attributes = {};
  for (const match of tag.matchAll(/([\w:-]+)="([^"]*)"/g)) {
    attributes[match[1]] = match[2];
  }
  return attributes;
}

function toNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseJunitTotals(xml) {
  const testsuitesMatch = xml.match(/<testsuites\b[^>]*>/);
  if (testsuitesMatch) {
    const attributes = getAttributes(testsuitesMatch[0]);
    if (attributes.tests !== undefined) {
      return {
        tests: toNumber(attributes.tests),
        failures: toNumber(attributes.failures),
        errors: toNumber(attributes.errors),
        skipped: toNumber(attributes.skipped),
        time: toNumber(attributes.time),
      };
    }
  }

  const totals = {
    tests: 0,
    failures: 0,
    errors: 0,
    skipped: 0,
    time: 0,
  };

  for (const match of xml.matchAll(/<testsuite\b[^>]*>/g)) {
    const attributes = getAttributes(match[0]);
    totals.tests += toNumber(attributes.tests);
    totals.failures += toNumber(attributes.failures);
    totals.errors += toNumber(attributes.errors);
    totals.skipped += toNumber(attributes.skipped);
    totals.time += toNumber(attributes.time);
  }

  return totals;
}

function formatPercent(value) {
  return `${toNumber(value).toFixed(2)}%`;
}

function formatDuration(value) {
  return `${toNumber(value).toFixed(2)}s`;
}

function formatCoverageRow(label, metric) {
  return `| ${label} | ${formatPercent(metric?.pct)} | ${toNumber(metric?.covered)} / ${toNumber(metric?.total)} |`;
}

export function buildSummaryMarkdown({ reports, coverageSummary }) {
  const lines = ['## Test and Coverage Report', ''];

  lines.push('### Test Results');
  if (reports.length === 0) {
    lines.push('No JUnit test report files were found.');
  } else {
    lines.push('| Suite | Tests | Failures | Errors | Skipped | Duration |');
    lines.push('| --- | ---: | ---: | ---: | ---: | ---: |');
    for (const report of reports) {
      const totals = parseJunitTotals(report.xml);
      lines.push(
        `| ${report.label} | ${totals.tests} | ${totals.failures} | ${totals.errors} | ${totals.skipped} | ${formatDuration(totals.time)} |`,
      );
    }
  }

  lines.push('', '### Unit Test Coverage');
  const total = coverageSummary?.total;
  if (!total) {
    lines.push('No Vitest coverage summary was found.');
  } else {
    lines.push('| Metric | Covered | Count |');
    lines.push('| --- | ---: | ---: |');
    lines.push(formatCoverageRow('Lines', total.lines));
    lines.push(formatCoverageRow('Statements', total.statements));
    lines.push(formatCoverageRow('Branches', total.branches));
    lines.push(formatCoverageRow('Functions', total.functions));
  }

  return `${lines.join('\n')}\n`;
}

function readReports(reportDefinitions) {
  return reportDefinitions
    .filter((report) => existsSync(report.path))
    .map((report) => ({
      label: report.label,
      xml: readFileSync(report.path, 'utf8'),
    }));
}

function readCoverageSummary(path) {
  if (!existsSync(path)) {
    return undefined;
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function writeSummary({
  junitReports = defaultJunitReports,
  coveragePath = defaultCoveragePath,
  summaryPath = process.env.GITHUB_STEP_SUMMARY,
} = {}) {
  const markdown = buildSummaryMarkdown({
    reports: readReports(junitReports),
    coverageSummary: readCoverageSummary(coveragePath),
  });

  if (summaryPath) {
    appendFileSync(summaryPath, markdown);
  } else {
    process.stdout.write(markdown);
  }

  return markdown;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeSummary();
}
