# Hide SMS UI and Add RSVP Search

## Goal

Remove SMS from every guest-facing and administrator-facing website flow while preserving the existing Twilio and SMS backend implementation for possible future use. Keep email delivery and email RSVP recovery unchanged. Add a public last-name search that returns matching households and lets a guest open the selected household's RSVP.

## Scope

### SMS UI

- Remove public links, controls, routes, and copy for standalone SMS enrollment and household SMS preferences.
- Remove phone-based RSVP recovery from the form and its client-side validation copy.
- Remove SMS as an administrator notification delivery option and hide SMS-specific administrator status or help copy.
- Keep ordinary household phone data available to administrators where it is useful as contact data; hiding SMS does not require deleting phone fields or stored phone numbers.
- Preserve the existing API routes, service methods, repository support, Twilio integration, infrastructure configuration, consent records, and tests that verify backend SMS behavior.
- Direct navigation to retired SMS frontend URLs must not expose an SMS enrollment or preference interface.

### Email

- Preserve SES delivery behavior and administrator email controls.
- Preserve email-based RSVP recovery, including its generic success response, abuse controls, and recoverable-link delivery.
- Update the recovery UI so it accepts and describes email addresses only.

### Last-name RSVP Search

- Add a public last-name search alongside invite-code entry and email recovery.
- Normalize a search by trimming surrounding whitespace and comparing last names case-insensitively.
- Match against invited household members, not submitted plus-ones.
- Return a capped, stable-sorted list of matching household display names and private RSVP URLs.
- Exclude archived households and households without a currently recoverable invitation code.
- Selecting a result opens that household's RSVP page.
- An empty result is a normal response. Validation errors are specific enough to correct malformed input, while runtime failures use generic guest-facing copy.

## API and Data Flow

Add a dedicated public search request and response contract under the shared package. The request contains only `lastName`. Each result contains only the household display name and RSVP URL needed by the interface; it does not return member records, email addresses, phone numbers, household identifiers, RSVP answers, or a separate plaintext invite-code field.

The API handler delegates to the wedding service. The service validates and normalizes the input, applies public-search rate limiting, obtains matching active households from the repository, filters out invitations that cannot be recovered, decrypts valid invite codes through the existing invite-code protector, and builds canonical RSVP URLs from `FRONTEND_BASE_URL`.

The repository adds a last-name lookup using the project's existing low-traffic DynamoDB access pattern. Matching remains exact after normalization. The implementation will cap results before returning them and use deterministic display-name ordering.

## Security and Privacy

This feature intentionally allows someone who knows a guest's last name to discover matching household display names and obtain access to those households' RSVP pages. That disclosure is accepted as a usability tradeoff.

The implementation still limits exposure:

- exact matching only; no prefix, substring, or fuzzy search,
- a small maximum result count,
- per-search-term and per-source-IP rate limits,
- no archived or unrecoverable invitations,
- no contact details, member lists, RSVP answers, household IDs, or standalone invite-code fields,
- no raw last names, invite codes, or RSVP URLs in application logs,
- and existing WAF/API Gateway protections remain applicable.

If the number of matches exceeds the response cap, the interface tells the guest to use email recovery or contact the couple rather than returning a partial list that appears complete.

## User Experience

The RSVP landing page keeps invite-code entry as the primary path. The secondary assistance area offers two distinct actions:

1. Search by last name and choose from matching household names.
2. Send the private RSVP link to the email address already saved with the household.

Search and recovery remain collapsed or visually secondary so the invite-code path stays simple. Loading feedback uses the site's existing silent loading primitives. Search results are keyboard accessible, clearly labeled, and usable on mobile.

No visible public or administrator copy refers to SMS, text updates, Twilio, SMS consent, or phone-based recovery while SMS UI is disabled.

## Documentation

Update `docs/ARCHITECTURE.md` to describe last-name search, the accepted disclosure model, email-only recovery in the UI, and dormant backend SMS capability. Update `docs/LAUNCH_READINESS.md` so launch checks exercise the visible email/search flows and treat SMS checks as optional steps for a future re-enable rather than current launch requirements.

## Testing

- Shared contract tests for valid and invalid search payloads and bounded responses.
- Repository tests for case-insensitive exact last-name matching and exclusion behavior.
- Service and handler tests for results, empty searches, caps, recoverability filtering, rate limiting, and log privacy.
- Frontend component tests proving email-only recovery, household result rendering, navigation, validation, and generic failures.
- Routing and public-page tests proving SMS pages and references are unavailable.
- Administrator tests proving email remains available and SMS is hidden.
- End-to-end tests covering invite-code entry, email recovery, last-name search, result selection, mobile behavior, and absence of SMS UI.
- Final typecheck, unit/integration tests, lint, web build, and browser/Playwright verification on a fresh local port.

## Non-goals

- Removing Twilio, SMS API routes, consent data, infrastructure configuration, or backend delivery code.
- Migrating or deleting stored phone numbers or SMS consent records.
- Changing email provider behavior or email content beyond UI wording needed for email-only recovery.
- Adding fuzzy name search, first-name filtering, postal-code verification, CAPTCHA, or a new external search service.
