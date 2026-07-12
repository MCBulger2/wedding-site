import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const manifestVersion = 1;

export async function computeResponsiveImageInputHash({
  sourceRoot,
  sourceFiles,
  extraFiles = [],
}) {
  const hash = crypto.createHash('sha256');
  hash.update(`responsive-image-cache-v${manifestVersion}\0`);

  for (const sourceFile of [...sourceFiles].sort()) {
    await updateHashWithFile({
      hash,
      label: `source:${normalizeRelativePath(sourceFile)}`,
      filePath: path.join(sourceRoot, sourceFile),
    });
  }

  for (const extraFile of [...extraFiles].sort((left, right) =>
    left.label.localeCompare(right.label),
  )) {
    await updateHashWithFile({
      hash,
      label: `extra:${extraFile.label}`,
      filePath: extraFile.filePath,
    });
  }

  return hash.digest('hex');
}

export async function readValidResponsiveImageCache({
  manifestPath,
  outputRoot,
  inputHash,
  requiredFiles = [],
}) {
  try {
    for (const requiredFile of requiredFiles) {
      const stat = await fs.stat(requiredFile);
      if (!stat.isFile()) {
        return undefined;
      }
    }

    const rawManifest = await fs.readFile(manifestPath, 'utf8');
    const manifest = JSON.parse(rawManifest);

    if (
      manifest.version !== manifestVersion ||
      manifest.inputHash !== inputHash ||
      !Array.isArray(manifest.generatedFiles)
    ) {
      return undefined;
    }

    const generatedFiles = [];
    const generatedFileSet = new Set();
    for (const generatedFile of manifest.generatedFiles) {
      if (
        typeof generatedFile !== 'string' ||
        !isSafeRelativePath(generatedFile)
      ) {
        return undefined;
      }

      const normalizedFile = normalizeRelativePath(generatedFile);
      const stat = await fs.stat(path.join(outputRoot, normalizedFile));
      if (!stat.isFile()) {
        return undefined;
      }

      generatedFiles.push(normalizedFile);
      generatedFileSet.add(normalizedFile);
    }

    const manifestRelativePath = normalizeRelativePath(
      path.relative(outputRoot, manifestPath),
    );
    for (const outputFile of await listFiles(outputRoot)) {
      if (
        outputFile !== manifestRelativePath &&
        !generatedFileSet.has(outputFile)
      ) {
        return undefined;
      }
    }

    return { version: manifestVersion, inputHash, generatedFiles };
  } catch {
    return undefined;
  }
}

export async function writeResponsiveImageCacheManifest({
  manifestPath,
  inputHash,
  generatedFiles,
}) {
  const normalizedFiles = [...generatedFiles]
    .map((generatedFile) => normalizeRelativePath(generatedFile))
    .sort();

  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        version: manifestVersion,
        inputHash,
        generatedFiles: normalizedFiles,
      },
      null,
      2,
    )}\n`,
  );
}

async function updateHashWithFile({ hash, label, filePath }) {
  hash.update(label);
  hash.update('\0');
  hash.update(await fs.readFile(filePath));
  hash.update('\0');
}

async function listFiles(root, currentDirectory = root) {
  const entries = await fs.readdir(currentDirectory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(currentDirectory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(root, entryPath)));
    } else if (entry.isFile()) {
      files.push(normalizeRelativePath(path.relative(root, entryPath)));
    }
  }

  return files.sort();
}

function isSafeRelativePath(candidate) {
  const normalized = normalizeRelativePath(candidate);
  return (
    normalized.length > 0 &&
    !path.isAbsolute(candidate) &&
    normalized !== '..' &&
    !normalized.startsWith('../')
  );
}

function normalizeRelativePath(relativePath) {
  return relativePath.split(path.sep).join('/');
}
