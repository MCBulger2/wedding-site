# UI Polish Design

## Goal

Resolve every issue identified in the July 11 UI audit without changing the site's established visual direction.

## Design

- Preserve desktop typography, color, imagery, routes, RSVP behavior, admin authentication, and external registry links.
- Make responsive ownership explicit inside each CSS module so later module rules cannot override global breakpoint fixes.
- Use a deliberate two-row mobile header: brand and theme control first, then all four primary navigation links on one row.
- Present the mobile RSVP lookup in reading order: title and explanation, lookup form, then the three process steps.
- Stack the mobile admin sign-in panels without overlap and keep both panels within the viewport.
- Reapply a valid homepage hash after React renders and reserve sticky-header space with `scroll-margin-top`.
- Hide unconfirmed hotel data instead of publishing invented facts. Replace placeholder story and registry language with finished, factual copy.
- Keep the OpenStreetMap iframe and its attribution, remove the iframe-owned untranslated marker, and add a labeled app-owned marker over a taller mobile map.

## Testing

Add regression coverage for responsive geometry, reading order, hash navigation, public-copy invariants, and map accessibility. Verify with focused unit tests, the full test/lint/typecheck/build suite, Playwright on a fresh port, and rendered desktop/mobile browser checks.

## Non-goals

No redesign, hamburger navigation, new map dependency, invented hotel details, new imagery, API changes, or infrastructure changes.
