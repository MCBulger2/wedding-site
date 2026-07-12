# Final Review Fix Report

## Root cause

Standalone SMS activation identified a pending attempt only by status, normalized phone, and millisecond `consentedAt`. Two same-phone requests created in one millisecond therefore had identical CAS fingerprints, allowing the older provider response to activate the newer pending write.

## RED

Added a controlled concurrency regression in `apps/api/src/service.test.ts`. Both requests use the same phone and fixed system timestamp. The first confirmation is delayed, the second pending write replaces it, and the older confirmation is released first.

Command:

`npx vitest run apps/api/src/service.test.ts -t "same-millisecond"`

Observed failure before implementation:

- 1 test failed.
- Expected the older request to reject with retryable status 409.
- Actual result was fulfilled, proving it activated the newer pending record.

The final minor log-redaction and frontend pending-state tests were also added before implementation. They passed against existing behavior, documenting already-correct behavior without requiring production changes.

## GREEN

Each standalone pending write now receives a cryptographically random UUID attempt identifier. DynamoDB persists it in the same atomic pending update and activation requires an exact attempt-ID match in addition to the existing consent fields. The in-memory repository mirrors the same CAS behavior. The service also verifies the activated aggregate retains its own attempt ID; a stale request returns retryable 409.

The attempt identifier remains persistence-only. Messenger calls still contain only the phone, and success/failure log tests assert that raw phone, normalized phone, source IP, subscription hash, and attempt ID are absent.

## Files

- `apps/api/src/service.ts`: generate and enforce the opaque attempt version.
- `apps/api/src/repository.ts`: persist the attempt ID atomically and include it in Dynamo/in-memory activation CAS.
- `apps/api/src/service.test.ts`: same-millisecond concurrency reproduction, failed-log redaction, and attempt-ID non-disclosure coverage.
- `apps/api/src/repository.test.ts`: pending update and activation-condition coverage for the attempt ID.
- `apps/web/src/pages/PublicPages.test.tsx`: `pending_confirmation` user-facing state coverage.
- `docs/ARCHITECTURE.md`: document concurrency ordering and confidentiality.

## Final verification

- `npx vitest run apps/api/src/repository.test.ts apps/api/src/service.test.ts apps/api/src/notifications.test.ts apps/web/src/pages/PublicPages.test.tsx`: 4 files passed, 96 tests passed.
- `npm run typecheck`: passed for shared, API, web, and infra projects.
- `npm run lint`: passed.
- `git diff --check`: passed (Git emitted only expected LF-to-CRLF working-copy warnings).

## Concerns

None. Existing standalone records are compatible because every enrollment writes a fresh pending aggregate and attempt ID before activation.
