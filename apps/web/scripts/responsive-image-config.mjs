export const sourceDir = 'image-sources';
export const outputDir = 'public/images';
export const metadataOutput = 'src/generated/responsiveImageAssets.ts';
export const backgroundCssOutput = 'src/generated/responsiveImageBackgrounds.css';

export const formats = [
  { extension: 'avif', mimeType: 'image/avif', quality: 58 },
  { extension: 'webp', mimeType: 'image/webp', quality: 76 },
  { extension: 'jpg', mimeType: 'image/jpeg', quality: 82 },
];

export const responsiveImages = [
  {
    key: '/hero-wedding.jpg',
    source: 'hero-wedding.jpg',
    widths: [640, 960, 1440, 1920],
    backgroundVariable: '--image-hero-wedding',
    backgroundWidths: { oneX: 960, twoX: 1920 },
  },
  {
    key: '/registry-down-payment-fund.jpg',
    source: 'registry-down-payment-fund.jpg',
    widths: [480, 800, 1200],
  },
  {
    key: '/registry-honeymoon-fund.jpg',
    source: 'registry-honeymoon-fund.jpg',
    widths: [480, 800, 1200],
  },
  {
    key: '/ring.jpg',
    source: 'ring.jpg',
    widths: [480, 800, 1200],
  },
  {
    key: '/smile.jpg',
    source: 'smile.jpg',
    widths: [480, 800, 1200],
  },
];
