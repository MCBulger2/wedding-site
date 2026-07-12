import { execFileSync } from 'node:child_process';

const generatedPaths = [
  'public/images',
  'src/generated/responsiveImageAssets.ts',
  'src/generated/responsiveImageBackgrounds.css',
];
const trackedFiles = execFileSync(
  'git',
  ['ls-files', ...generatedPaths],
  { encoding: 'utf8' },
)
  .trim()
  .split('\n')
  .filter(Boolean);

if (trackedFiles.length > 0) {
  console.error(
    [
      'Generated responsive image outputs must not be committed.',
      'Run git rm --cached for generated variants and manifests, then let the web build regenerate them.',
      '',
      ...trackedFiles,
    ].join('\n'),
  );
  process.exit(1);
}
