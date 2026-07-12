# Public SMS Opt-In Design

## Goal

Replace the public SMS proof page with a real, publicly accessible consent flow that Twilio reviewers can inspect and submit end to end. The implementation must prioritize the representative's feedback: the page must collect a mobile number, show an unchecked consent checkbox, enroll on submission, use the site's public branding and contact identity, and link directly to Terms and Privacy.

## Scope

The public flow will live at `/sms-updates`. The existing `/sms-opt-in-proof` path will redirect to the new route so saved links do not strand reviewers on obsolete content. All public copy will describe a live opt-in and will remove “proof,” “example,” and “does not enroll” framing.

The page will include:

- Matt & Alison Wedding branding and `contact@matt-alison.com`;
- a mobile-number field;
- an optional SMS consent checkbox that is unchecked by default;
- the existing consent language for RSVP recovery, schedule updates, and wedding logistics;
- message frequency, message/data rates, HELP, and STOP disclosures;
- direct links to Terms and Privacy; and
- a submit action with accessible validation, saving, success, and failure states.

SMS consent remains separate from RSVP. No invitation code, RSVP submission, or phone number is required to complete an RSVP, and this public form will not alter an RSVP.

## API and Data Model

Add a public `POST /api/sms-subscriptions` endpoint. Its request accepts a mobile number and an affirmative consent flag. Shared validation requires affirmative consent and validates the phone; the service normalizes the number before persistence or delivery.

Standalone SMS subscription records will use the existing DynamoDB table but remain separate from household and RSVP records. Each record stores the normalized phone, consent lifecycle status, source, consent-text version, and timestamps. A deterministic normalized-phone hash will identify a subscription so repeat submissions update the same record instead of creating duplicates while preserving the original creation timestamp. This follows the repository's current practice of storing household contact phone numbers in DynamoDB while preventing the raw phone or any phone-derived subscription identifier from appearing in application logs.

The lifecycle mirrors private SMS preferences:

1. Atomically persist `pending_confirmation` with the current consent text version.
2. Send the existing Twilio confirmation message.
3. Atomically transition that exact pending consent to `opted_in` only after Twilio returns HTTP 2xx.
4. If Twilio fails, retain the pending state and return a retryable provider error.
5. If a concurrent resubmission replaces the pending attempt, the older request must not activate or report success for the replacement.

Repeat submissions are safe. An already active number may receive a fresh confirmation and an updated consent timestamp, providing current evidence for the public form submission.

## Abuse Protection and Privacy

The endpoint will apply service-level rate limits per normalized phone and source IP using hashed rate-limit keys and the existing expiring DynamoDB rate-limit mechanism. API Gateway will also receive route-specific throttling. The limits must permit normal reviewer retries while reducing SMS-bombing risk.

Request logging will use a fixed route name and will not include the submitted number. Application logs may include outcome and provider metadata but never the raw phone or phone-derived subscription identifier. Responses will not reveal whether the number belongs to an invited household.

The standalone record establishes consent for the public Matt & Alison Wedding SMS program. It does not create an invitation, disclose guest data, or grant access to a private RSVP. Existing household consent, RSVP recovery authorization, and admin household messaging rules remain unchanged.

Terms and Privacy will explicitly describe standalone public phone and consent collection while preserving the limited, non-promotional wedding-program scope. Twilio remains responsible for carrier-level STOP enforcement; website-side STOP synchronization and standalone bulk broadcasts are outside this change and must not be implied by the public copy.

## Error Handling

- Missing or invalid phone: return a validation error and keep the form editable.
- Unchecked consent: block submission in the UI and API with a clear consent-required message.
- Rate limit exceeded: return a retry-later response without exposing stored data.
- Twilio unavailable or rejected request: keep the record pending and show a retryable service message.
- Success: show that enrollment is active after Twilio accepts the confirmation message request and remind the subscriber they can reply STOP to opt out; do not claim handset delivery.
- Concurrent replacement: return a conflict/retry response rather than reporting a stale request as active.

## Routing and Compatibility

The SPA route parser and site layout will recognize `/sms-updates` as the canonical public page. `/sms-opt-in-proof` will immediately replace itself with `/sms-updates`. Documentation, end-to-end tests, and launch checks will reference only the canonical route.

The CloudFront/API infrastructure will expose `POST /api/sms-subscriptions`, attach it to the default stage dependency ordering, and configure conservative route throttling.

## Testing and Verification

Add tests proving:

- shared request validation rejects missing consent and invalid phones;
- the repository persists, updates, and conditionally activates standalone consent records;
- the service normalizes numbers, records pending consent, sends confirmation, activates only after provider success, preserves pending state on failure, and rate-limits abusive retries;
- the handler routes the public endpoint before unrelated routes and keeps phone data out of structured logs;
- infrastructure creates the route and throttle settings;
- the public React page starts unchecked, prevents consentless submission, submits a checked phone, renders success/failure states, links Terms and Privacy, and contains none of the prohibited proof/example framing;
- the obsolete URL redirects to `/sms-updates`; and
- Playwright completes the public opt-in interaction at desktop and mobile-relevant layouts using a mocked API response.

Final verification will run relevant unit tests, type checking, lint, the web build, end-to-end tests on a fresh local port, and manual browser inspection of the public flow. Any local server started for inspection will be stopped and its port checked before completion.

After an authorized deployment and before Twilio resubmission, a controlled-handset smoke test must prove the exact public URL works without authentication, a real branded confirmation containing HELP/STOP is received, DynamoDB transitions the one subscription record from pending to active, repeat enrollment does not create a duplicate, and logs contain no raw number. The URL should not be sent to the Twilio representative until this live gate passes.

## Non-Goals

- Do not change RSVP submission or private invitation consent behavior.
- Do not add promotional messaging or broaden the stated use case.
- Do not build a new bulk-broadcast interface in this change.
- Do not deploy production infrastructure or resubmit Twilio verification automatically.
