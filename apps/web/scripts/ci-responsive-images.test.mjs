import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const repoRoot = new URL('../../../', import.meta.url);

function readWorkspaceFile(relativePath) {
  return readFileSync(new URL(relativePath, repoRoot), 'utf8');
}

describe('CI responsive image preparation', () => {
  it('keeps typecheck free of responsive image generation lifecycle hooks', () => {
    const rootPackage = JSON.parse(readWorkspaceFile('package.json'));

    expect(rootPackage.scripts).not.toHaveProperty('pretypecheck');
  });

  it('restores and prepares responsive images before validation and builds', () => {
    const workflow = readWorkspaceFile('.github/workflows/ci.yml');
    const cacheIndex = workflow.indexOf('- name: Cache responsive images');
    const prepareIndex = workflow.indexOf(
      '- run: npm run images:generate -w apps/web',
    );
    const lintIndex = workflow.indexOf('- run: npm run lint');
    const typecheckIndex = workflow.indexOf('- run: npm run typecheck');
    const testIndex = workflow.indexOf('- run: npm run test:ci');
    const buildIndex = workflow.indexOf('- run: npm run build');

    expect(cacheIndex).toBeGreaterThan(-1);
    expect(prepareIndex).toBeGreaterThan(cacheIndex);
    expect(lintIndex).toBeGreaterThan(prepareIndex);
    expect(typecheckIndex).toBeGreaterThan(prepareIndex);
    expect(testIndex).toBeGreaterThan(prepareIndex);
    expect(buildIndex).toBeGreaterThan(prepareIndex);
  });

  it('prepares responsive images in deploy verification before validation and builds', () => {
    const workflow = readWorkspaceFile('.github/workflows/deploy.yml');
    const deployVerifyStart = workflow.indexOf('  deploy-verify:');
    const deployVerify = workflow.slice(
      deployVerifyStart,
      workflow.indexOf('\n  deploy-staging:', deployVerifyStart),
    );
    const cacheIndex = deployVerify.indexOf('- name: Cache responsive images');
    const prepareIndex = deployVerify.indexOf(
      '- run: npm run images:generate -w apps/web',
    );
    const lintIndex = deployVerify.indexOf('- run: npm run lint');
    const typecheckIndex = deployVerify.indexOf('- run: npm run typecheck');
    const testIndex = deployVerify.indexOf('- run: npm run test:ci');
    const buildIndex = deployVerify.indexOf('- run: npm run build');

    expect(cacheIndex).toBeGreaterThan(-1);
    expect(prepareIndex).toBeGreaterThan(cacheIndex);
    expect(lintIndex).toBeGreaterThan(prepareIndex);
    expect(typecheckIndex).toBeGreaterThan(prepareIndex);
    expect(testIndex).toBeGreaterThan(prepareIndex);
    expect(buildIndex).toBeGreaterThan(prepareIndex);
  });
});
