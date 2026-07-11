# Task 1 Implementation Report

## Summary

Implemented Twilio toll-free reverification and SMS consent hardening across shared contracts, API service/routing, Twilio messaging, React UI, CDK, tests, Playwright coverage, admin display, and launch documentation.

## Changed files

- Shared contracts/tests: `packages/shared/src/index.ts`, `packages/shared/src/index.test.ts`
- API/service/tests: `apps/api/src/service.ts`, `apps/api/src/service.test.ts`, `apps/api/src/handler.ts`, `apps/api/src/handler.test.ts`, `apps/api/src/notifications.ts`, `apps/api/src/notifications.test.ts`
- Web/UI/tests: `apps/web/src/api.ts`, `apps/web/src/App.tsx`, `apps/web/src/App.test.tsx`, `apps/web/src/pages/RsvpPages.tsx`, `apps/web/src/pages/RsvpPages.test.tsx`, `apps/web/src/pages/PublicPages.tsx`, `apps/web/src/pages/AdminPage.tsx`
- E2E coverage: `apps/web/e2e/home.spec.ts`
- Infrastructure/tests: `infra/lib/wedding-site-stack.ts`, `infra/lib/wedding-site-stack.test.ts`
- Documentation: `docs/ARCHITECTURE.md`, `docs/LAUNCH_READINESS.md`

## RED evidence

1. `npm test -- packages/shared/src/index.test.ts apps/api/src/service.test.ts`
   - Expected exit 1.
   - 11 focused failures: RSVP/recovery still accepted enrollment fields, pending/opted-out schemas were missing, `updateSmsPreferences` was missing, recovery still enrolled SMS, and consent lifecycle behavior was absent.
2. `npm test -- apps/api/src/handler.test.ts infra/lib/wedding-site-stack.test.ts`
   - Expected exit 1.
   - 2 focused failures: nested SMS preferences request was captured by the generic RSVP route and CDK lacked the matching throttled route setting.
3. `npm test -- apps/web/src/pages/RsvpPages.test.tsx`
   - Expected exit 1.
   - Standalone SMS preferences component was undefined, proving the new UI behavior was not present.

## GREEN evidence

- Focused integration: `npm test -- apps/web/src/pages/RsvpPages.test.tsx apps/web/src/App.test.tsx apps/api/src/service.test.ts apps/api/src/notifications.test.ts apps/api/src/handler.test.ts packages/shared/src/index.test.ts`
  - Exit 0; 6 files, 123 tests passed.
- Full suite: `npm test`
  - Exit 0; 23 files, 182 tests passed.
- `npm run typecheck`
  - Exit 0.
- `npm run lint`
  - Exit 0, no warnings or errors.
- `npm run build`
  - Exit 0; shared, API, web/Vite, and infrastructure builds completed.
- `git diff --check`
  - Exit 0; only Git line-ending notices, no whitespace errors.

## Behavior delivered

- Existing `opted_in` records remain valid; consent now supports pending, active, and opted-out states.
- RSVP and recovery no longer enroll SMS. Phone recovery is generic and sends only for matching active consent.
- `PUT /api/rsvp/{inviteCode}/sms-preferences` precedes generic RSVP routing and is throttled like RSVP PUT.
- Enable persists pending, sends the exact required Twilio confirmation, then activates only after HTTP success. Provider failure remains pending and returns a sanitized 503.
- Disable is immediate, preserves household phone, and prevents application SMS.
- Recovery and admin SMS are idempotently brand-prefixed and retain HELP/STOP text.
- Standalone private-invitation SMS preferences page, explicit re-consent for phone changes, website opt-out, RSVP/success links, SPA routing, and legal/proof updates are included.
- Admin displays distinguish active, pending, opted-out, and missing consent.

## Self-review

- Confirmed no new service, table, dependency, webhook, provider-console mutation, deployment, or live SMS was introduced.
- Confirmed SES/email paths were not changed.
- Confirmed logging additions contain household IDs and sanitized provider state only; they do not include phones, SMS bodies, consent text, invite codes, or private RSVP URLs.
- Confirmed activation reloads persisted state before writing active, so an explicit opt-out during the same request flow is not overwritten.
- Confirmed responsive-image generator outputs have no content diff and are excluded from the scoped commit.

## Concerns

- Full Playwright/browser execution is intentionally deferred to the orchestrator per the task brief; coverage was updated but not executed by this builder.
- Twilio carrier delivery occurs after the application transaction and is intentionally not used as the activation boundary; Twilio HTTP 2xx is the boundary.
