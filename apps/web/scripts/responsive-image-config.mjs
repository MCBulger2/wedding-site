export const sourceDir = 'image-sources';
export const outputDir = 'public/images';
export const metadataOutput = 'src/generated/responsiveImageAssets.ts';
export const backgroundCssOutput =
  'src/generated/responsiveImageBackgrounds.css';

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
  {
    key: '/asu-graduation.jpg',
    source: 'asu-graduation.jpg',
    widths: [640, 960, 1440, 1920],
  },
  {
    key: '/asu-spin.JPEG',
    source: 'asu-spin.JPEG',
    widths: [320, 480, 640, 768],
  },
  {
    key: '/asu.JPEG',
    source: 'asu.JPEG',
    widths: [320, 480, 640, 768],
  },
  {
    key: '/asu-hockey.JPEG',
    source: 'asu-hockey.JPEG',
    widths: [640, 960, 1440, 1920],
  },
  {
    key: '/canadian-grand-prix.jpg',
    source: 'canadian-grand-prix.jpg',
    widths: [640, 960, 1440, 1920],
  },
  {
    key: '/drs.JPEG',
    source: 'drs.JPEG',
    widths: [480, 640, 960, 1200],
  },
  {
    key: '/canada-ferris-wheel.JPEG',
    source: 'canada-ferris-wheel.JPEG',
    widths: [640, 960, 1440, 1920],
  },
  {
    key: '/canada-alison-flowers.JPEG',
    source: 'canada-alison-flowers.JPEG',
    widths: [480, 640, 960, 1200],
  },
  {
    key: '/san-diego.JPEG',
    source: 'san-diego.JPEG',
    widths: [640, 960, 1440, 1920],
  },
  {
    key: '/vegas-bellagio.JPEG',
    source: 'vegas-bellagio.JPEG',
    widths: [480, 640, 960, 1200],
  },
  {
    key: '/niagara-falls.JPEG',
    source: 'niagara-falls.JPEG',
    widths: [640, 960, 1440, 1920],
  },
  {
    key: '/engagement-01.jpg',
    source: 'engagement-01.jpg',
    widths: [480, 800, 1200],
  },
  {
    key: '/engagement-02.jpg',
    source: 'engagement-02.jpg',
    widths: [480, 800, 1200],
  },
  {
    key: '/engagement-03.jpg',
    source: 'engagement-03.jpg',
    widths: [480, 800, 1200],
  },
  {
    key: '/engagement-04.jpg',
    source: 'engagement-04.jpg',
    widths: [480, 800, 1200],
  },
  {
    key: '/engagement-05.jpg',
    source: 'engagement-05.jpg',
    widths: [480, 800, 1200],
  },
  {
    key: '/engagement-06.jpg',
    source: 'engagement-06.jpg',
    widths: [480, 800, 1200],
  },
  {
    key: '/engagement-07.jpg',
    source: 'engagement-07.jpg',
    widths: [480, 800, 1200],
  },
  {
    key: '/engagement-08.jpg',
    source: 'engagement-08.jpg',
    widths: [480, 800, 1200],
  },
  {
    key: '/engagement-09.jpg',
    source: 'engagement-09.jpg',
    widths: [480, 800, 1200],
  },
  {
    key: '/engagement-10.jpg',
    source: 'engagement-10.jpg',
    widths: [480, 800, 1200],
    backgroundVariable: '--image-engagement-10',
    backgroundWidths: { oneX: 960, twoX: 1920 },
  },
  {
    key: '/close-up.jpg',
    source: 'close-up.jpg',
    widths: [480, 800, 1200],
  },
  {
    key: '/engagement-11.jpg',
    source: 'engagement-11.jpg',
    widths: [480, 800, 1200],
  },
  {
    key: '/lego.jpg',
    source: 'lego.jpg',
    widths: [480, 800, 1200],
  },
  {
    key: '/oreganos.jpg',
    source: 'oreganos.jpg',
    widths: [480, 800, 1200],
  },
  {
    key: '/buck-and-rider.jpg',
    source: 'buck-and-rider.jpg',
    widths: [480, 800, 1200],
  },
  {
    key: '/sushi.jpg',
    source: 'sushi.jpg',
    widths: [480, 800, 1200],
  },
  {
    key: '/botanical-gardens.jpeg',
    source: 'botanical-gardens.jpeg',
    widths: [480, 800, 1200],
  },
  {
    key: '/papago-park.jpg',
    source: 'papago-park.jpg',
    widths: [480, 800, 1200],
  },
  {
    key: '/mcdowell-sonoran-preserve.jpg',
    source: 'mcdowell-sonoran-preserve.jpg',
    widths: [480, 800, 1200],
  },
  {
    key: '/piestwa-peak.png',
    source: 'piestwa-peak.png',
    widths: [480, 800, 1200],
  },
  {
    key: '/odysea.jpg',
    source: 'odysea.jpg',
    widths: [480, 800, 1200],
  },
];
