# Responsive UI Polish Design

## Goal

Make the public, RSVP, and admin surfaces feel consistent and professional at desktop and mobile sizes while correcting the admin table overflow, admin-only button treatment, loading-state spacing, and venue-map marker behavior.

## Confirmed scope

- Preserve the current mobile admin household cards.
- Keep the standard site button styling unchanged. Only controls within the authenticated admin dashboard grid receive the quieter surface-matched treatment.
- Restore the embedded map's native location marker by removing the application-level fixed marker overlay.
- Correct spacing inconsistencies in shared loading skeletons and the admin dashboard's cards, controls, and result areas.

## Layout and styling

### Shared loading states

Loading shells and skeleton groups will use the same vertical rhythm as the content they replace. Skeleton stats, rows, controls, and cards will preserve their eventual component padding and gap so the layout does not jump when content resolves. Existing silent loading behavior and accessibility semantics remain unchanged.

### Admin dashboard

The desktop table remains the dashboard's dense-data layout and the mobile cards remain the small-screen layout. At the intermediate range where the desktop table is displayed but its columns exceed the available card width, the table shell will constrain to its parent and expose horizontal overflow. The table keeps its established minimum width; the page itself must not become horizontally scrollable.

Within the admin grid only, ordinary action buttons will use the surrounding surface/background rather than a dark green fill, with the accent color carried by text and border. Disabled, danger, menu, header-toolbar, and non-admin controls preserve their current semantic styling unless a targeted spacing correction requires otherwise. Hover and keyboard focus remain clearly visible.

Admin cards, stats, filters, table areas, and skeletons will receive small spacing corrections only where their internal rhythm differs from adjacent components. No information architecture, copy, or data behavior changes are included.

### Venue map

The custom absolutely positioned marker will be removed. The existing OpenStreetMap embed will own marker placement during panning and zooming, restoring the original expected behavior while leaving the accessible venue name and outbound map link intact.

## Verification

- Add regression coverage for the native-map-marker rendering, admin table/card breakpoint behavior, and the scoped admin action-button treatment.
- Verify shared loading-state classes retain stable dimensions and spacing.
- Run type checking, unit tests, build, and the repository Playwright suite.
- Manually audit every user-facing route with the local admin mock at desktop, intermediate-table, and mobile widths, checking overflow, controls, loading states, map behavior, and console health.

## Constraints

- Preserve unrelated generated responsive-image changes already present in the worktree.
- Do not alter public, RSVP, header, footer, or hero button colors.
- Do not introduce dependencies or change backend behavior.
