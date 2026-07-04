import type { ImgHTMLAttributes } from 'react';
import {
  responsiveImageAssets,
  type ResponsiveImageAsset,
} from '../generated/responsiveImageAssets.js';

interface ResponsiveImageProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> {
  src: string;
  alt: string;
  objectPosition?: string;
}

export function ResponsiveImage({
  src,
  alt,
  objectPosition,
  style,
  sizes = '100vw',
  ...imageProps
}: ResponsiveImageProps) {
  const assets = responsiveImageAssets as Record<
    string,
    ResponsiveImageAsset | undefined
  >;
  const asset = assets[src];

  if (!asset) {
    return (
      <img
        {...imageProps}
        alt={alt}
        src={src}
        style={{ ...style, objectPosition }}
      />
    );
  }

  return (
    <picture className="responsive-image-picture">
      {asset.sources.map((source) => (
        <source
          key={source.type}
          sizes={sizes}
          srcSet={source.srcSet}
          type={source.type}
        />
      ))}
      <img
        {...imageProps}
        alt={alt}
        decoding={imageProps.decoding ?? 'async'}
        height={asset.height}
        sizes={sizes}
        src={asset.fallback.src}
        style={{ ...style, objectPosition }}
        width={asset.width}
      />
    </picture>
  );
}
