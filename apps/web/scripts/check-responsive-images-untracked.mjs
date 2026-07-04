import { execFileSync } from 'node:child_process';

const generatedImagePath = 'public/images';
const trackedFiles = execFileSync(
  'git',
  ['ls-files', generatedImagePath],
  { encoding: 'utf8' },
)
  .trim()
  .split('\n')
  .filter(Boolean);

if (trackedFiles.length > 0) {
  console.error(
    [
      `Generated responsive image variants must not be committed under ${generatedImagePath}.`,
      'Run git rm --cached for generated variants and let the web build regenerate them.',
      '',
      ...trackedFiles,
    ].join('\n'),
  );
  process.exit(1);
}
