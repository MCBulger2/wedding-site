# Engagement Photo Carousel Design

## Scope

Add all 11 photos from `C:\Users\mcbul\Downloads\new_engagement_photos` to the homepage photo carousel. The Our Story page and its existing imagery remain unchanged.

## Approach

Copy the source JPEGs into the existing `apps/web/image-sources` directory using stable, visitor-independent filenames. Register each source in `apps/web/scripts/responsive-image-config.mjs` so the existing build-time pipeline generates AVIF, WebP, and JPEG variants at the carousel's supported widths. Add one `GalleryPhoto` entry per source to `packages/shared/src/siteContent.ts` with descriptive alt text and captions derived from visual inspection.

The existing `ResponsiveImage` component and carousel behavior remain unchanged. The first existing photo remains the eager image; all subsequent slides remain lazy-loaded. No new route, lightbox, data store, or UI control is introduced.

## Verification

- Run the responsive-image generator/check and relevant shared/web unit tests.
- Run typecheck, lint, and the web build to validate generated metadata and asset references.
- Run the public homepage end-to-end/browser check on a fresh local port and confirm that all 13 carousel slides (2 existing plus 11 new) are present and the new images load.
- Stop the local dev server and confirm its port is no longer listening.
