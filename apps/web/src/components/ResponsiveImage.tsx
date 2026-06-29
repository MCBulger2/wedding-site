type ResponsiveImageAsset = {
  src: string;
  alt: string;
  objectPosition?: string;
  width?: number;
  height?: number;
  fallbackSrc?: string;
  avifSrcSet?: string;
  webpSrcSet?: string;
  jpegSrcSet?: string;
};

type ResponsiveImageProps = {
  image: ResponsiveImageAsset;
  sizes?: string;
  alt?: string;
  loading?: 'eager' | 'lazy';
  decoding?: 'async' | 'auto' | 'sync';
  fetchPriority?: 'high' | 'low' | 'auto';
  width?: number;
  height?: number;
  className?: string;
  pictureClassName?: string;
  objectPosition?: string;
};

export function ResponsiveImage({
  image,
  sizes,
  alt,
  loading,
  decoding = 'async',
  fetchPriority,
  width,
  height,
  className,
  pictureClassName,
  objectPosition,
}: ResponsiveImageProps) {
  const resolvedAlt = alt ?? image.alt;
  const resolvedWidth = width ?? image.width;
  const resolvedHeight = height ?? image.height;
  const resolvedSrc = image.fallbackSrc ?? image.src;
  const resolvedObjectPosition = objectPosition ?? image.objectPosition;
  const style = resolvedObjectPosition
    ? { objectPosition: resolvedObjectPosition }
    : undefined;
  const fetchPriorityAttribute = fetchPriority
    ? ({ fetchpriority: fetchPriority } as Record<string, string>)
    : undefined;

  return (
    <picture className={pictureClassName}>
      {image.avifSrcSet && (
        <source srcSet={image.avifSrcSet} sizes={sizes} type="image/avif" />
      )}
      {image.webpSrcSet && (
        <source srcSet={image.webpSrcSet} sizes={sizes} type="image/webp" />
      )}
      {image.jpegSrcSet && (
        <source srcSet={image.jpegSrcSet} sizes={sizes} type="image/jpeg" />
      )}
      <img
        src={resolvedSrc}
        srcSet={image.jpegSrcSet}
        sizes={sizes}
        alt={resolvedAlt}
        loading={loading}
        decoding={decoding}
        {...fetchPriorityAttribute}
        width={resolvedWidth}
        height={resolvedHeight}
        className={className}
        style={style}
      />
    </picture>
  );
}
