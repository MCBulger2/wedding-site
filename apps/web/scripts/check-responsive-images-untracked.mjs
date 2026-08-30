import { execFileSync } from 'node:child_process';

const generatedPaths = [
  'public/images',
  'src/generated/responsiveImageAssets.ts',
  'src/generated/responsiveImageBackgrounds.css',
];

try {
  execFileSync('git', ['ls-files', '--error-unmatch', ...generatedPaths], {
    stdio: 'ignore',
  });
} catch {
  console.error(
    [
      'Generated responsive image outputs are missing from Git.',
      'Run npm run images:generate -w apps/web and commit the variants and manifests.',
      '',
      ...generatedPaths,
    ].join('\n'),
  );
  process.exit(1);
}
