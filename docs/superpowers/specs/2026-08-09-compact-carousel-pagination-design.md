# Compact Carousel Pagination Design

## Goal

Keep the homepage photo carousel readable and compact as the gallery grows, without replacing its native scrolling behavior or adding a carousel dependency.

## Design

The active photo caption remains below the image and uses the carousel's full width. The per-photo dot buttons are replaced with a compact status such as `1 of 13` and a subtle progress bar. The status is announced politely when the active slide changes, while the visual progress bar is hidden from assistive technology.

Native horizontal scrolling, touch momentum, scroll snapping, previous and next arrows, wraparound button navigation, horizontal-wheel throttling, responsive images, and caption updates remain unchanged. Removing dot-based random access is intentional; guests can continue to use swipe, wheel, or arrow navigation.

## Responsive Behavior

The caption and pagination are stacked in one column at every viewport size. The pagination itself uses a fixed-width count beside a flexible progress track, so neither element can compress the caption. The result must avoid horizontal overflow at 1024 by 800 and 390 by 844 viewports.

## Accessibility

The counter uses `role="status"`, `aria-live="polite"`, `aria-atomic="true"`, and the accessible name `Photo position`. The progress track is decorative and uses `aria-hidden="true"`. Existing carousel, slide, image, and navigation-button semantics remain unchanged.

## Verification

- Update the existing Playwright carousel coverage before production code and confirm it fails against the dot implementation.
- Verify native swipe and arrow navigation update the caption, counter, and progress together.
- Verify the caption retains the full carousel width at desktop and mobile breakpoints with no document overflow.
- Run focused carousel E2E tests, typecheck, lint, the web build, the full E2E suite, and in-app browser checks at desktop and mobile sizes.

