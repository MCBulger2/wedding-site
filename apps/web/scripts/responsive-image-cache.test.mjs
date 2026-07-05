import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  computeResponsiveImageInputHash,
  readValidResponsiveImageCache,
  writeResponsiveImageCacheManifest,
} from './responsive-image-cache.mjs';

let tempRoot;

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), 'responsive-image-cache-'),
  );
});

afterEach(async () => {
  await fs.rm(tempRoot, { force: true, recursive: true });
});

describe('responsive image cache helpers', () => {
  it('changes the input hash when source image content changes', async () => {
    const sourceRoot = path.join(tempRoot, 'image-sources');
    await fs.mkdir(sourceRoot, { recursive: true });
    await fs.writeFile(path.join(sourceRoot, 'hero.jpg'), 'first image bytes');
    await fs.writeFile(path.join(tempRoot, 'config.mjs'), 'widths = [640]');

    const firstHash = await computeResponsiveImageInputHash({
      sourceRoot,
      sourceFiles: ['hero.jpg'],
      extraFiles: [
        { label: 'config', filePath: path.join(tempRoot, 'config.mjs') },
      ],
    });

    await fs.writeFile(
      path.join(sourceRoot, 'hero.jpg'),
      'changed image bytes',
    );

    const secondHash = await computeResponsiveImageInputHash({
      sourceRoot,
      sourceFiles: ['hero.jpg'],
      extraFiles: [
        { label: 'config', filePath: path.join(tempRoot, 'config.mjs') },
      ],
    });

    expect(secondHash).not.toBe(firstHash);
  });

  it('accepts a cache manifest when every generated file is present', async () => {
    const outputRoot = path.join(tempRoot, 'public', 'images');
    const manifestPath = path.join(outputRoot, '.responsive-image-cache.json');
    await fs.mkdir(outputRoot, { recursive: true });
    await fs.writeFile(path.join(outputRoot, 'hero-640.avif'), 'avif');
    await fs.writeFile(path.join(outputRoot, 'hero-640.webp'), 'webp');

    await writeResponsiveImageCacheManifest({
      manifestPath,
      inputHash: 'matching-hash',
      generatedFiles: ['hero-640.avif', 'hero-640.webp'],
    });

    const manifest = await readValidResponsiveImageCache({
      manifestPath,
      outputRoot,
      inputHash: 'matching-hash',
    });

    expect(manifest?.generatedFiles).toEqual([
      'hero-640.avif',
      'hero-640.webp',
    ]);
  });

  it('rejects a cache manifest when stale generated files are present', async () => {
    const outputRoot = path.join(tempRoot, 'public', 'images');
    const manifestPath = path.join(outputRoot, '.responsive-image-cache.json');
    await fs.mkdir(outputRoot, { recursive: true });
    await fs.writeFile(path.join(outputRoot, 'hero-640.avif'), 'avif');
    await fs.writeFile(path.join(outputRoot, 'hero-960.avif'), 'stale');

    await writeResponsiveImageCacheManifest({
      manifestPath,
      inputHash: 'matching-hash',
      generatedFiles: ['hero-640.avif'],
    });

    const manifest = await readValidResponsiveImageCache({
      manifestPath,
      outputRoot,
      inputHash: 'matching-hash',
    });

    expect(manifest).toBeUndefined();
  });
});
