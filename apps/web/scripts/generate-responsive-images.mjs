import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  computeResponsiveImageInputHash,
  readValidResponsiveImageCache,
  writeResponsiveImageCacheManifest,
} from './responsive-image-cache.mjs';
import {
  backgroundCssOutput,
  formats,
  metadataOutput,
  outputDir,
  responsiveImages,
  sourceDir,
} from './responsive-image-config.mjs';

const webRoot = path.resolve(import.meta.dirname, '..');
const sourceRoot = path.join(webRoot, sourceDir);
const outputRoot = path.join(webRoot, outputDir);
const metadataPath = path.join(webRoot, metadataOutput);
const backgroundCssPath = path.join(webRoot, backgroundCssOutput);
const cacheManifestPath = path.join(outputRoot, '.responsive-image-cache.json');
const repoRoot = path.resolve(webRoot, '..', '..');
const generationStartedAt = Date.now();
const variantConcurrency =
  parsePositiveInt(process.env.RESPONSIVE_IMAGE_VARIANT_CONCURRENCY) ??
  Math.max(2, Math.min(8, Math.floor((os.availableParallelism?.() ?? 4) / 2)));

const inputHash = await computeResponsiveImageInputHash({
  sourceRoot,
  sourceFiles: responsiveImages.map((image) => image.source),
  extraFiles: [
    {
      label: 'generate-responsive-images.mjs',
      filePath: fileURLToPath(import.meta.url),
    },
    {
      label: 'responsive-image-cache.mjs',
      filePath: fileURLToPath(
        new URL('./responsive-image-cache.mjs', import.meta.url),
      ),
    },
    {
      label: 'responsive-image-config.mjs',
      filePath: fileURLToPath(
        new URL('./responsive-image-config.mjs', import.meta.url),
      ),
    },
    {
      label: 'apps/web/package.json',
      filePath: path.join(webRoot, 'package.json'),
    },
  ],
});

const cachedImages = await readValidResponsiveImageCache({
  manifestPath: cacheManifestPath,
  outputRoot,
  inputHash,
  requiredFiles: [metadataPath, backgroundCssPath],
});

if (cachedImages) {
  console.log(
    `Reused ${cachedImages.generatedFiles.length} cached responsive image variants from ${outputDir}`,
  );
  process.exit(0);
}

await fs.rm(outputRoot, { force: true, recursive: true });
await fs.mkdir(outputRoot, { recursive: true });
await fs.mkdir(path.dirname(metadataPath), { recursive: true });

const manifestEntries = [];
const backgroundDeclarations = [];
const generatedFiles = [];

for (const image of responsiveImages) {
  const sourcePath = path.join(sourceRoot, image.source);
  const baseName = path.basename(image.source, path.extname(image.source));
  const metadata = await sharp(sourcePath).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error(`Could not read dimensions for ${image.source}`);
  }

  const widths = image.widths.filter((width) => width <= metadata.width);
  if (!widths.includes(metadata.width) && metadata.width < image.widths[0]) {
    widths.push(metadata.width);
  }

  const generatedFormats = [];
  for (const format of formats) {
    const targetWidths = selectTargetWidths({
      widths,
      formatExtension: format.extension,
      backgroundWidths: image.backgroundWidths,
    });
    const variants = await runWithConcurrencyLimit(
      targetWidths,
      variantConcurrency,
      async (width) => {
        const outputFileName = `${baseName}-${width}.${format.extension}`;
        const outputPath = path.join(outputRoot, outputFileName);
        const pipeline = sharp(sourcePath)
          .rotate()
          .resize({ width, withoutEnlargement: true });

        if (format.extension === 'avif') {
          await pipeline.avif({ quality: format.quality }).toFile(outputPath);
        } else if (format.extension === 'webp') {
          await pipeline.webp({ quality: format.quality }).toFile(outputPath);
        } else {
          await pipeline
            .jpeg({ quality: format.quality, mozjpeg: true })
            .toFile(outputPath);
        }

        return {
          src: `/images/${outputFileName}`,
          width,
          height: Math.round((width * metadata.height) / metadata.width),
          outputFileName,
        };
      },
    );
    generatedFiles.push(...variants.map((variant) => variant.outputFileName));
    generatedFormats.push({ ...format, variants });
  }

  const jpeg = generatedFormats.find((format) => format.extension === 'jpg');
  const fallback = jpeg?.variants.at(-1);
  if (!fallback) {
    throw new Error(`Could not generate JPEG fallback for ${image.source}`);
  }

  manifestEntries.push({
    key: image.key,
    width: fallback.width,
    height: fallback.height,
    fallback,
    sources: generatedFormats
      .filter((format) => format.extension !== 'jpg')
      .map((format) => ({
        type: format.mimeType,
        srcSet: format.variants
          .map((variant) => `${variant.src} ${variant.width}w`)
          .join(', '),
      })),
  });

  if (image.backgroundVariable && image.backgroundWidths) {
    backgroundDeclarations.push(
      buildBackgroundDeclaration(image, generatedFormats),
    );
  }
}

await fs.writeFile(metadataPath, buildMetadata(manifestEntries));
await fs.writeFile(
  backgroundCssPath,
  buildBackgroundCss(backgroundDeclarations),
);
await writeResponsiveImageCacheManifest({
  manifestPath: cacheManifestPath,
  inputHash,
  generatedFiles,
});

console.log(
  `Generated ${manifestEntries.length} responsive image manifests in ${outputDir} (${generatedFiles.length} variants in ${Math.round((Date.now() - generationStartedAt) / 1000)}s using concurrency ${variantConcurrency})`,
);

function parsePositiveInt(value) {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return undefined;
  }

  return parsed;
}

async function runWithConcurrencyLimit(items, limit, worker) {
  if (items.length === 0) {
    return [];
  }

  const results = new Array(items.length);
  const workerCount = Math.max(1, Math.min(limit, items.length));
  let cursor = 0;

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await worker(items[index], index);
      }
    }),
  );

  return results;
}

function buildBackgroundDeclaration(image, generatedFormats) {
  const candidates = [];
  for (const format of generatedFormats) {
    for (const [scale, width] of [
      ['1x', image.backgroundWidths.oneX],
      ['2x', image.backgroundWidths.twoX],
    ]) {
      const variant = findNearestVariant(format.variants, width);
      candidates.push(
        `url('${variant.src}') type('${format.mimeType}') ${scale}`,
      );
    }
  }

  return `  ${image.backgroundVariable}: image-set(${candidates.join(', ')});`;
}

function findNearestVariant(variants, width) {
  return (
    variants.find((variant) => variant.width >= width) ??
    variants[variants.length - 1]
  );
}

function selectTargetWidths({ widths, formatExtension, backgroundWidths }) {
  if (formatExtension !== 'jpg') {
    return widths;
  }

  const targetWidths = new Set([Math.max(...widths)]);
  if (backgroundWidths) {
    targetWidths.add(backgroundWidths.oneX);
    targetWidths.add(backgroundWidths.twoX);
  }

  return widths.filter((width) => targetWidths.has(width));
}

function buildMetadata(entries) {
  return `// This file is generated by apps/web/scripts/generate-responsive-images.mjs.
// Do not edit by hand.

export interface ResponsiveImageSource {
  type: string;
  srcSet: string;
}

export interface ResponsiveImageAsset {
  width: number;
  height: number;
  fallback: {
    src: string;
    width: number;
    height: number;
  };
  sources: ResponsiveImageSource[];
}

export const responsiveImageAssets = ${JSON.stringify(
    Object.fromEntries(
      entries.map((entry) => [
        entry.key,
        {
          width: entry.width,
          height: entry.height,
          fallback: entry.fallback,
          sources: entry.sources,
        },
      ]),
    ),
    null,
    2,
  )} as const satisfies Record<string, ResponsiveImageAsset>;
`;
}

function buildBackgroundCss(declarations) {
  return `/* This file is generated by apps/web/scripts/generate-responsive-images.mjs. */
/* Do not edit by hand. */

:root {
${declarations.join('\n')}
}
`;
}
