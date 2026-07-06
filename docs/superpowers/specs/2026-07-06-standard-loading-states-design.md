# Standard Loading States Design

## Goal

Standardize web loading and fallback UI so route, RSVP, and admin loading states feel like one system. Loading and fallback areas must not render visible loading text.

## Selected Approach

Use a shared hybrid loading system:

- Skeletons appear when the target layout shape is known, such as RSVP cards, admin stat tiles, and household cards.
- A single silent loading animation appears when the app needs an indeterminate cue, such as route chunk fallbacks, QR generation, refresh overlays, and short inline waits.
- Full-page data loads can combine the silent animation with skeleton lines.

## Components

Create shared loading primitives under `apps/web/src/components/LoadingStates.tsx`.

- `LoadingPulse` renders the existing mark animation without visible label or message.
- `LoadingScreen` renders a card-style fallback with optional skeleton lines and a silent loading animation.
- `RouteLoadingFallback` renders a route-level fallback for `Suspense`.
- `SkeletonStat`, `SkeletonDashboard`, and skeleton line primitives support known admin and RSVP shapes without duplicating local component code.

The components should remain presentation-focused and use the existing global CSS classes where possible. They should not fetch data, own business state, or introduce a new state-management abstraction.

## Behavior

- Replace all `Loading...` route fallbacks in `App.tsx`.
- Remove visible loading copy from loading/fallback areas in `RsvpPages.tsx` and `AdminPage.tsx`.
- Keep button labels and normal form control labels intact, including disabled button text during submission. The no-text rule applies to loading/fallback regions, not ordinary buttons.
- Use `aria-label` or `aria-live` on loading containers where needed so assistive technology still gets status semantics without visible copy.
- Preserve existing RSVP and admin behavior outside loading presentation.

## Testing

- Add unit coverage proving RSVP loading states no longer render visible loading copy.
- Add unit coverage for the shared loading primitives.
- Keep existing RSVP/admin behavior tests passing.
- Run code-level checks and rendered browser/Playwright verification because this changes visual frontend behavior.

## Out Of Scope

- Redesigning the RSVP or admin pages.
- Changing API loading behavior or request sequencing.
- Removing normal disabled button labels such as submit/save progress text.
