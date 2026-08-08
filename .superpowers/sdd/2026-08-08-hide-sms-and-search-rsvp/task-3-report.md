# Task 3 report: rate-limited RSVP search service and API route

Date: 2026-08-08
Branch: HEAD (detached worktree)

## Implementation

- Added `WeddingService.searchRsvps(input, { sourceIp, baseUrl })` in `apps/api/src/service.ts`.
- Enforced:
  - schema validation via `RsvpSearchRequestSchema`
  - one-hour fixed-window rate limiting with:
    - `RSVP_SEARCH_TERM_LIMIT = 5`
    - `RSVP_SEARCH_IP_LIMIT = 20`
    - `RSVP_SEARCH_RESULT_LIMIT = 10`
  - hashed rate-limit keys using:
    - `rsvp-search-term:${normalizedLastName}`
    - `rsvp-search-ip:${sourceIp || 'unknown'}`
  - archived and unrecoverable household filtering
  - stable case-insensitive display-name sorting before invite-code recovery
  - `tooManyMatches: true` with no returned URLs when more than 10 recoverable matches exist
  - canonical RSVP URL generation through `buildInvitationDetails`
  - fail-closed behavior when `FRONTEND_BASE_URL`/`baseUrl` is missing
  - structured search logging with only event/outcome/resultCount/tooManyMatches
- Extended `apps/api/src/logger.ts` allowlist so the safe `resultCount` and `tooManyMatches` fields are retained.
- Added unauthenticated `POST /api/rsvp/search` handling in `apps/api/src/handler.ts`, passing body, source IP, and canonical base URL to `service.searchRsvps`.
- Added route-name resolution for `POST /rsvp/search`.
- Added CDK route registration and stage throttling for `POST /api/rsvp/search` in `infra/lib/wedding-site-stack.ts` with:
  - burst 5
  - rate 2
- Preserved existing RSVP recovery and SMS subscription/preference behavior and route coverage.

## Files changed

- `apps/api/src/service.ts`
- `apps/api/src/service.test.ts`
- `apps/api/src/handler.ts`
- `apps/api/src/handler.test.ts`
- `infra/lib/wedding-site-stack.ts`
- `infra/lib/wedding-site-stack.test.ts`
- `apps/api/src/logger.ts`

## RED/GREEN cycle 1: service

### RED command

`npm test -- apps/api/src/service.test.ts`

### RED output

```text
❯ apps/api/src/service.test.ts (65 tests | 6 failed)
× validates search input before lookup
× finds households by last name, sorts display names stably, and omits raw terms from logs
× skips archived and unrecoverable matches
× returns tooManyMatches without leaking RSVP URLs when more than ten recoverable households match
× rate limits repeated search terms and source ips for one hour
× fails closed when the canonical frontend URL is missing

TypeError: service.searchRsvps is not a function
```

### GREEN command

`npm test -- apps/api/src/service.test.ts`

### GREEN output

```text
Test Files  1 passed (1)
Tests  65 passed (65)
```

## RED/GREEN cycle 2: handler + infrastructure

### RED command

`npm test -- apps/api/src/handler.test.ts infra/lib/wedding-site-stack.test.ts`

### RED output

```text
❯ apps/api/src/handler.test.ts (18 tests | 1 failed)
× passes RSVP search requests through with source IP and canonical base URL

❯ infra/lib/wedding-site-stack.test.ts (26 tests | 2 failed)
× synthesizes CloudFormation-compatible route setting keys
× creates the configured API routes before applying stage route settings

expected 404 to be 200
expected route settings to include POST /api/rsvp/search
expected route count 6 but got 5
```

### GREEN command

`npm test -- apps/api/src/handler.test.ts infra/lib/wedding-site-stack.test.ts`

### GREEN output

```text
Test Files  2 passed (2)
Tests  44 passed (44)
```

## Final focused verification

### Command

`npm test -- apps/api/src/service.test.ts apps/api/src/handler.test.ts infra/lib/wedding-site-stack.test.ts`

### Output

```text
Test Files  3 passed (3)
Tests  109 passed (109)
```

## Self-review

- Confirmed raw last names, invite codes, RSVP URLs, and source IPs are not added to new service or handler logs.
- Confirmed `POST /api/rsvp/search` is routed before generic `/rsvp/{inviteCode}` handling.
- Confirmed stack synthesis still includes both SMS routes:
  - `PUT /api/rsvp/{inviteCode}/sms-preferences`
  - `POST /api/sms-subscriptions`
- Confirmed the new search route shares the existing API Lambda integration and stage dependency pattern.
- Confirmed the only extra file outside the brief was `apps/api/src/logger.ts`, needed so the safe structured log fields asserted by the brief are actually emitted.

## Concerns

- `git diff --check` reported only existing LF-to-CRLF normalization warnings in the working copy; no whitespace or merge issues.
- The worktree is on detached `HEAD`, so the commit is local to this worktree until the user moves or pushes it.

## Fix round: Important review findings

### Scope

- Fixed only:
  - term rate-limit canonicalization to match case-insensitive repository matching
  - per-household corrupt/decryption-mismatch handling in public RSVP search
- Did not address the reviewer’s minor tie-breaker suggestion.

### Root causes

- Finding 1: `searchRsvps` derived `rsvp-search-term:` hashes from `trim()` only, while `listHouseholdsByLastName` matches on `trim().toLocaleLowerCase('en-US')`, so `Example`, `example`, and `EXAMPLE` consumed different limiter buckets.
- Finding 2: `searchRsvps` called `getRecoverableInviteCode` directly inside the result loop. A corrupted or hash-mismatched stored secret threw and aborted the entire public search instead of excluding just that household.

### Test changes

- Added a focused service test proving mixed-case variants of the same last name share the 5-attempt term limit.
- Added a focused service test proving one corrupt matching household is skipped while one valid matching household still returns successfully, with no raw last name, invite code, or RSVP URL logged.

### RED command

`npm test -- apps/api/src/service.test.ts`

### RED output

```text
❯ apps/api/src/service.test.ts (67 tests | 2 failed)
× shares the term rate limit across en-US case variants of the same last name
× excludes corrupt matching invitations and still returns valid matches without logging raw search data

AssertionError: promise resolved instead of rejecting
Error: Stored invite code does not match the current household invite hash
```

### GREEN command

`npm test -- apps/api/src/service.test.ts`

### GREEN output

```text
Test Files  1 passed (1)
Tests  67 passed (67)
```

### Implementation notes

- Canonicalized public search last names with the same `trim().toLocaleLowerCase('en-US')` rule used by repository matching before deriving the term hash and before querying the repository.
- Wrapped per-household `getRecoverableInviteCode` calls in `searchRsvps` so corrupt/mismatched invitation records are treated as unrecoverable and skipped safely.

### Fix-round self-review

- Confirmed the sixth case-variant attempt now returns 429 because all variants share one term bucket.
- Confirmed corrupt matching records no longer fail the whole search response.
- Confirmed the valid matching household still returns its RSVP URL.
- Confirmed no new raw last names, invite codes, or RSVP URLs appear in service logs for the corrupt-household case.
