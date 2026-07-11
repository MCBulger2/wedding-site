# Footer Contact Email Design

## Goal

Update the shared site footer so its identity reads `Matt & Alison Wedding` instead of `Matt & Alison`, and display the public contact email as a clickable link.

## Design

The footer's left-side content will read:

`Matt & Alison Wedding · January 18, 2027 · contact@matt-alison.com`

The displayed address and `mailto:` target will come from `siteContent.contact`, preserving the existing `VITE_CONTACT_EMAIL_ADDRESS` environment override. The wedding date will continue to come from `siteContent.dateLabel`. Terms, Privacy, and conditional Admin links will remain unchanged.

The implementation will stay within the existing `SiteFooter` component and its scoped styles. Any small wrapping adjustment needed for narrow screens will reuse the current responsive footer layout rather than introduce a new component or content model.

## Validation

- Add focused end-to-end assertions for the updated footer identity and email link.
- Run the relevant frontend typecheck and end-to-end footer coverage.
- Inspect the footer in a browser at desktop and mobile widths on public, RSVP, and admin routes.

## Non-goals

- Changing the homepage heading or other uses of `siteContent.coupleNames`.
- Changing the configured contact address or deployment environment variables.
- Redesigning the footer or altering its legal and admin links.
