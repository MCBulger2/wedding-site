import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const repoRoot = new URL('../../../', import.meta.url);

function readWorkspaceFile(relativePath) {
  return readFileSync(new URL(relativePath, repoRoot), 'utf8');
}

describe('CI responsive image outputs', () => {
  it('keeps typecheck free of responsive image generation lifecycle hooks', () => {
    const rootPackage = JSON.parse(readWorkspaceFile('package.json'));

    expect(rootPackage.scripts).not.toHaveProperty('pretypecheck');
  });

  it('uses committed responsive images during validation and builds', () => {
    const workflow = readWorkspaceFile('.github/workflows/ci.yml');
    const lintIndex = workflow.indexOf('- run: npm run lint');
    const typecheckIndex = workflow.indexOf('- run: npm run typecheck');
    const testIndex = workflow.indexOf('- run: npm run test:ci');
    const buildIndex = workflow.indexOf('- run: npm run build');

    expect(workflow).not.toContain('Cache responsive images');
    expect(workflow).not.toContain('npm run images:generate -w apps/web');
    expect(lintIndex).toBeGreaterThan(-1);
    expect(typecheckIndex).toBeGreaterThan(lintIndex);
    expect(testIndex).toBeGreaterThan(typecheckIndex);
    expect(buildIndex).toBeGreaterThan(testIndex);
  });

  it('uses committed responsive images in deployment jobs', () => {
    const workflow = readWorkspaceFile('.github/workflows/deploy.yml');
    const deployVerifyStart = workflow.indexOf('  deploy-verify:');
    const deployVerify = workflow.slice(
      deployVerifyStart,
      workflow.indexOf('\n  deploy-staging:', deployVerifyStart),
    );
    const lintIndex = deployVerify.indexOf('- run: npm run lint');
    const typecheckIndex = deployVerify.indexOf('- run: npm run typecheck');
    const testIndex = deployVerify.indexOf('- run: npm run test:ci');
    const buildIndex = deployVerify.indexOf('- run: npm run build');

    expect(workflow).not.toContain('Cache responsive images');
    expect(workflow).not.toContain('npm run images:generate -w apps/web');
    expect(lintIndex).toBeGreaterThan(-1);
    expect(typecheckIndex).toBeGreaterThan(lintIndex);
    expect(testIndex).toBeGreaterThan(typecheckIndex);
    expect(buildIndex).toBeGreaterThan(testIndex);
  });
});
