# Hide SMS UI and Add RSVP Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide every SMS-facing website control while preserving dormant backend SMS support, keep email recovery unchanged, and add an exact last-name search that returns matching household RSVP links.

**Architecture:** Add shared request/response contracts and a public `POST /api/rsvp/search` path backed by the existing low-traffic DynamoDB household scan and KMS invite-code recovery. The React RSVP landing page will expose invite-code entry, last-name search, and email-only recovery as clearly separated paths; existing SMS APIs and services remain deployed but their public/admin frontend entry points disappear.

**Tech Stack:** TypeScript 6, React 19, Zod 4, AWS Lambda/API Gateway/DynamoDB/KMS via CDK, Vitest/Testing Library, Playwright.

## Global Constraints

- Match last names exactly after trimming and case folding; do not add prefix, substring, or fuzzy search.
- Match invited household members only, never submitted plus-ones.
- Return household display names and RSVP URLs only; never return household IDs, contacts, member lists, RSVP answers, or standalone invite-code fields.
- Exclude archived households and invitations without a currently recoverable invite code.
- Return at most 10 households, stable-sorted by display name; if more than 10 match, return no partial list and set `tooManyMatches: true`.
- Rate-limit by peppered search term and peppered source IP; never log raw last names, invite codes, or RSVP URLs.
- Preserve SES email behavior and email recovery semantics.
- Preserve SMS schemas, API routes, service/repository behavior, Twilio integration, consent records, and infrastructure configuration.
- Keep household phone fields available as ordinary administrator contact data, but remove SMS-specific visible copy and controls.
- Reuse existing styles, loading primitives, responsive layout, and accessibility patterns; add no dependencies.

---

### Task 1: Add shared RSVP-search contracts

**Files:**
- Modify: `packages/shared/src/index.ts:61-62,388-416`
- Test: `packages/shared/src/index.test.ts:200-240`

**Interfaces:**
- Produces: `RsvpSearchRequestSchema`, `RsvpSearchRequest`, `RsvpSearchResultSchema`, `RsvpSearchResponseSchema`, and `RsvpSearchResponse`.
- Response shape: `{ results: Array<{ displayName: string; rsvpUrl: string }>; tooManyMatches: boolean }`.

- [ ] **Step 1: Write failing schema tests**

Add tests proving trimmed names of 1-80 characters parse, blank/overlong names fail, valid HTTPS RSVP URLs parse, and a response cannot contain extra household fields:

```ts
expect(RsvpSearchRequestSchema.parse({ lastName: '  Example  ' })).toEqual({
  lastName: 'Example',
});
expect(RsvpSearchRequestSchema.safeParse({ lastName: ' ' }).success).toBe(false);
expect(RsvpSearchResponseSchema.parse({
  results: [{ displayName: 'The Example Household', rsvpUrl: 'https://matt-alison.com/rsvp/A2B3C4D5E6' }],
  tooManyMatches: false,
}).results).toHaveLength(1);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- packages/shared/src/index.test.ts`

Expected: FAIL because `RsvpSearchRequestSchema` and `RsvpSearchResponseSchema` are not exported.

- [ ] **Step 3: Implement the contracts**

Add strict Zod contracts:

```ts
export const RsvpSearchRequestSchema = z.object({
  lastName: z.string().trim().min(1).max(80),
}).strict();

export const RsvpSearchResultSchema = z.object({
  displayName: z.string().trim().min(1).max(160),
  rsvpUrl: z.string().url(),
}).strict();

export const RsvpSearchResponseSchema = z.object({
  results: z.array(RsvpSearchResultSchema).max(10),
  tooManyMatches: z.boolean(),
}).strict();
```

Export inferred request/response types next to the schemas.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- packages/shared/src/index.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the contract**

```powershell
git add packages/shared/src/index.ts packages/shared/src/index.test.ts
git commit -m "feat: add RSVP search contracts"
```

### Task 2: Add exact last-name repository lookup

**Files:**
- Modify: `apps/api/src/repository.ts:59-67,148-166,494-530`
- Test: `apps/api/src/repository.test.ts`

**Interfaces:**
- Produces: `WeddingRepository.listHouseholdsByLastName(lastName: string): Promise<Household[]>`.
- Consumes: `Household.members[].lastName`; submitted RSVP plus-ones are intentionally inaccessible to this method.

- [ ] **Step 1: Write failing Dynamo and in-memory repository tests**

Add fixtures with `Example`, `example`, `Examples`, and a matching plus-one only. Assert the method returns only households with invited members whose trimmed last name case-folds to `example`, across paginated scan results.

```ts
const matches = await repository.listHouseholdsByLastName('  EXAMPLE  ');
expect(matches.map((household) => household.householdId)).toEqual(['h1', 'h2']);
```

- [ ] **Step 2: Run the repository test and verify RED**

Run: `npm test -- apps/api/src/repository.test.ts`

Expected: FAIL because `listHouseholdsByLastName` does not exist.

- [ ] **Step 3: Implement the repository method**

Add a shared local normalizer and filter the existing household scan result in both repositories:

```ts
function normalizeLastName(value: string): string {
  return value.trim().toLocaleLowerCase('en-US');
}

async listHouseholdsByLastName(lastName: string): Promise<Household[]> {
  const normalized = normalizeLastName(lastName);
  return (await this.listHouseholds()).filter((household) =>
    household.members.some((member) => normalizeLastName(member.lastName) === normalized),
  );
}
```

Do not inspect `StoredRsvp.plusOnes` and do not add a DynamoDB index for this low-volume guest list.

- [ ] **Step 4: Run the repository test and verify GREEN**

Run: `npm test -- apps/api/src/repository.test.ts`

Expected: PASS, including pagination and exact-match assertions.

- [ ] **Step 5: Commit the repository behavior**

```powershell
git add apps/api/src/repository.ts apps/api/src/repository.test.ts
git commit -m "feat: find households by invited last name"
```

### Task 3: Implement rate-limited RSVP search service and API route

**Files:**
- Modify: `apps/api/src/service.ts:1-40,359-497,1413-1480`
- Modify: `apps/api/src/handler.ts:63-166`
- Modify: `infra/lib/wedding-site-stack.ts:343-402`
- Test: `apps/api/src/service.test.ts`
- Test: `apps/api/src/handler.test.ts`
- Test: `infra/test/wedding-site-stack.test.ts`

**Interfaces:**
- Consumes: `RsvpSearchRequestSchema` and `WeddingRepository.listHouseholdsByLastName`.
- Produces: `WeddingService.searchRsvps(input, { sourceIp, baseUrl }): Promise<RsvpSearchResponse>`.
- Produces: unauthenticated `POST /api/rsvp/search` with API Gateway throttling of 2 requests/second and burst 5.

- [ ] **Step 1: Write failing service tests**

Cover validation, case-insensitive lookup delegation, stable display-name sorting, archived/unrecoverable filtering, valid URL construction, the 10-result cap, `tooManyMatches`, per-term/IP rate limits, missing `FRONTEND_BASE_URL`, and structured logs that omit the raw last name and generated URL.

```ts
const response = await service.searchRsvps(
  { lastName: 'Example' },
  { sourceIp: '203.0.113.10', baseUrl: 'https://matt-alison.com' },
);
expect(response).toEqual({
  results: [{ displayName: 'The Example Household', rsvpUrl: 'https://matt-alison.com/rsvp/A2B3C4D5E6' }],
  tooManyMatches: false,
});
```

Name the production change that makes each test pass: the new `searchRsvps` service method, not mock call counts alone.

- [ ] **Step 2: Run service tests and verify RED**

Run: `npm test -- apps/api/src/service.test.ts`

Expected: FAIL because `searchRsvps` does not exist.

- [ ] **Step 3: Implement minimal service behavior**

Add constants `RSVP_SEARCH_RESULT_LIMIT = 10`, `RSVP_SEARCH_TERM_LIMIT = 5`, and `RSVP_SEARCH_IP_LIMIT = 20` using the existing one-hour recovery window. Hash keys with distinct prefixes:

```ts
const termHash = stableHash(`rsvp-search-term:${normalizedLastName}`, this.inviteCodePepper);
const sourceIpHash = stableHash(
  `rsvp-search-ip:${requestContext.sourceIp?.trim() || 'unknown'}`,
  this.inviteCodePepper,
);
```

Use `recordRsvpRecoveryAttempt` for storage, return HTTP 429 through `PublicError` when limited, sort eligible households before decrypting, and inspect the filtered count before limiting to detect overflow. Return no results with `tooManyMatches: true` when more than 10 recoverable households match. Build links through `buildInvitationDetails` so canonical URL behavior stays centralized. Log only event name, outcome, result count, and `tooManyMatches`.

- [ ] **Step 4: Run service tests and verify GREEN**

Run: `npm test -- apps/api/src/service.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing handler and CDK tests**

Assert `POST /rsvp/search` passes body, source IP, and base URL to `searchRsvps`; assert CDK synthesizes `POST /api/rsvp/search` with burst 5/rate 2 while retaining both SMS routes.

- [ ] **Step 6: Run handler and infrastructure tests and verify RED**

Run: `npm test -- apps/api/src/handler.test.ts infra/test/wedding-site-stack.test.ts`

Expected: FAIL because the route and throttling configuration do not exist.

- [ ] **Step 7: Wire the handler and infrastructure route**

Add `'searchRsvps'` to the handler service pick, route before generic RSVP handling, CDK route registration, dependency list, and route settings:

```ts
if (method === 'POST' && path === '/rsvp/search') {
  return completeRequest(json(await service.searchRsvps(body, {
    sourceIp: event.requestContext.http.sourceIp,
    baseUrl: frontendBaseUrl(),
  })));
}
```

- [ ] **Step 8: Run handler and infrastructure tests and verify GREEN**

Run: `npm test -- apps/api/src/handler.test.ts infra/test/wedding-site-stack.test.ts`

Expected: PASS and existing SMS backend route tests remain green.

- [ ] **Step 9: Commit the public search API**

```powershell
git add apps/api/src/service.ts apps/api/src/service.test.ts apps/api/src/handler.ts apps/api/src/handler.test.ts infra/lib/wedding-site-stack.ts infra/test/wedding-site-stack.test.ts
git commit -m "feat: add rate-limited RSVP household search"
```

### Task 4: Apply UX guidance and build the RSVP search/email recovery interface

**Files:**
- Modify: `apps/web/src/api.ts:1-123`
- Modify: `apps/web/src/pages/RsvpPages.tsx:1-267,1618-1685`
- Modify: `apps/web/src/pages/RsvpPages.module.css`
- Test: `apps/web/src/pages/RsvpPages.test.tsx:244-370`

**Interfaces:**
- Consumes: `RsvpSearchRequest`, `RsvpSearchResponse`, `searchRsvps(payload)`, and existing `recoverRsvpLink`.
- Produces: accessible last-name search results and email-only recovery UI within `RsvpLookupPage`.

- [ ] **Step 1: Invoke UI/UX and React guidance before editing**

Read and apply `product-design:index`, then the routed skill it selects for a targeted existing-flow improvement. Also read and apply `build-web-apps:react-best-practices`. Record the resulting interaction decisions in the implementation notes: invite code remains primary; search and email recovery are separate secondary actions; no modal; one expanded assistance panel at a time; results are an accessible named list; existing typography, spacing, controls, and silent loaders remain authoritative.

- [ ] **Step 2: Write failing frontend tests**

Mock `searchRsvps` and add tests for:

```ts
expect(searchRsvps).toHaveBeenCalledWith({ lastName: 'Example' });
expect(
  (await screen.findByRole('link', { name: 'The Example Household' }) as HTMLAnchorElement).href,
).toBe('https://matt-alison.com/rsvp/A2B3C4D5E6');
```

Also assert blank validation, empty results, `tooManyMatches`, generic runtime failure, silent loading semantics, keyboard-accessible expansion/focus, email-only labels/placeholders, rejection of phone input before submission, and mutual exclusivity of search/recovery panels.

- [ ] **Step 3: Run the focused UI tests and verify RED**

Run: `npm test -- apps/web/src/pages/RsvpPages.test.tsx`

Expected: FAIL because `searchRsvps` and the search interface do not exist and recovery still advertises phone.

- [ ] **Step 4: Add the API client**

```ts
export function searchRsvps(payload: RsvpSearchRequest): Promise<RsvpSearchResponse> {
  return request<RsvpSearchResponse>('/rsvp/search', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
```

- [ ] **Step 5: Implement the scoped RSVP assistance UI**

Keep invite-code entry untouched. Replace the single recovery toggle with two secondary buttons: `Search by last name` and `Email my RSVP link`. Add independent form state with one active panel, clear validation on edits, `LoadingPulse compact` during requests, `aria-live="polite"` result/status regions, and result anchors using API-provided URLs.

Email validation must accept email only:

```ts
function validateRecoveryEmail(value: string): string | undefined {
  const trimmed = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
    ? undefined
    : 'Enter a valid email address.';
}
```

Use copy that explains exact matching and advises email recovery/contact when there are too many matches. Do not mention phone, text, or SMS.

- [ ] **Step 6: Style within the existing component module**

Add only scoped classes needed for assistance actions, result list, and mobile stacking. Reuse existing button/card/input tokens and preserve focus indicators. At narrow widths, stack actions and make result links full-width without horizontal overflow.

- [ ] **Step 7: Run the focused UI tests and verify GREEN**

Run: `npm test -- apps/web/src/pages/RsvpPages.test.tsx`

Expected: PASS.

- [ ] **Step 8: Commit the RSVP lookup UI**

```powershell
git add apps/web/src/api.ts apps/web/src/pages/RsvpPages.tsx apps/web/src/pages/RsvpPages.module.css apps/web/src/pages/RsvpPages.test.tsx
git commit -m "feat: add household RSVP search"
```

### Task 5: Retire SMS frontend routes, links, and public copy

**Files:**
- Modify: `apps/web/src/App.tsx:1-49,141-240`
- Modify: `apps/web/src/components/SiteLayout.tsx:7-18`
- Modify: `apps/web/src/pages/PublicPages.tsx:1-21,450-610`
- Modify: `apps/web/src/pages/RsvpPages.tsx:920-950,960-1110,1245-1280`
- Test: `apps/web/src/App.test.tsx:240-305`
- Test: `apps/web/src/pages/RsvpPages.test.tsx:90-240,570-615`

**Interfaces:**
- Preserves: backend `POST /api/sms-subscriptions` and `PUT /api/rsvp/{inviteCode}/sms-preferences`.
- Produces: legacy frontend URL redirects that render no SMS UI.

- [ ] **Step 1: Rewrite tests first for retired SMS UI**

Replace tests that render SMS signup/preferences with assertions that:

```ts
expect(parseRoute('/sms-updates')).toEqual({ name: 'legacy_redirect', path: '/' });
expect(parseRoute('/rsvp/A2B3C4D5E6/sms-updates')).toEqual({
  name: 'legacy_redirect',
  path: '/rsvp/A2B3C4D5E6',
});
```

Assert RSVP and success pages contain no text-preferences links, and Terms/Privacy contain no visible `/sms|text updates|Twilio/i` copy.

- [ ] **Step 2: Run App and RSVP tests and verify RED**

Run: `npm test -- apps/web/src/App.test.tsx apps/web/src/pages/RsvpPages.test.tsx`

Expected: FAIL because the SMS routes/pages/links still render.

- [ ] **Step 3: Remove SMS frontend entry points**

Remove SMS page imports, lazy routes, route variants, RSVP/success links, and SMS-specific policy sections. Replace all former SMS paths with a generic `LegacyRedirect` component that calls `window.location.replace(path)` and renders nothing. Remove the SMS route variants from `HeaderRoute`.

Delete unused `SmsUpdatesPage` and `RsvpSmsUpdatesPage` component code and imports, but do not remove API client functions or shared SMS components/contracts because backend support remains intentionally available.

- [ ] **Step 4: Run App and RSVP tests and verify GREEN**

Run: `npm test -- apps/web/src/App.test.tsx apps/web/src/pages/RsvpPages.test.tsx`

Expected: PASS with direct legacy URLs redirected and no visible SMS copy.

- [ ] **Step 5: Commit public SMS hiding**

```powershell
git add apps/web/src/App.tsx apps/web/src/App.test.tsx apps/web/src/components/SiteLayout.tsx apps/web/src/pages/PublicPages.tsx apps/web/src/pages/RsvpPages.tsx apps/web/src/pages/RsvpPages.test.tsx
git commit -m "feat: hide SMS from public website flows"
```

### Task 6: Make administrator notification UI email-only

**Files:**
- Modify: `apps/web/src/pages/AdminPage.tsx:160-180,340-440,1360-1390,1995-2030,2580-2630,2900-2930,3095-3195`
- Test: `apps/web/src/App.test.tsx:280-310`
- Test: `apps/web/src/pages/AdminPage.test.tsx`
- Test: `apps/web/e2e/home.spec.ts:1740-2180`

**Interfaces:**
- Preserves: `sendHouseholdNotification` API support for `'email' | 'sms'` and all local/backend SMS mock behavior.
- Produces: administrator forms that can submit email notifications only.

- [ ] **Step 1: Write failing administrator UI tests**

Assert an SMS-consented household still exposes no SMS status badge, no SMS option, no Twilio/help copy, and no SMS-specific phone helper. Assert the notification form displays the saved email, subject, message, and sends `{ channel: 'email', subject, message }`.

- [ ] **Step 2: Run focused admin tests and verify RED**

Run: `npm test -- apps/web/src/App.test.tsx apps/web/src/pages/AdminPage.test.tsx`

Expected: FAIL because SMS statuses and delivery controls remain visible.

- [ ] **Step 3: Simplify only the administrator presentation**

Remove `smsPreferenceLabel` rendering, SMS-specific helper copy, and channel selection. Initialize `HouseholdNotificationFormState.channel` to `'email'`, show the destination email directly, retain subject/message controls, and keep the outbound payload typed through the existing shared union.

Change phone field guidance to neutral contact-data copy such as `Use a US 10-digit number or E.164 format such as +14805550100.` Do not remove phone editing or stored consent data.

- [ ] **Step 4: Run focused admin tests and verify GREEN**

Run: `npm test -- apps/web/src/App.test.tsx apps/web/src/pages/AdminPage.test.tsx`

Expected: PASS.

- [ ] **Step 5: Update the admin e2e scenario**

Delete browser actions that select SMS and assert Twilio delivery. Extend the existing email scenario to assert the channel selector is absent and the sent payload remains email-only.

- [ ] **Step 6: Commit administrator SMS hiding**

```powershell
git add apps/web/src/pages/AdminPage.tsx apps/web/src/pages/AdminPage.test.tsx apps/web/src/App.test.tsx apps/web/e2e/home.spec.ts
git commit -m "feat: make admin notifications email-only"
```

### Task 7: Update architecture and launch documentation

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/LAUNCH_READINESS.md`

**Interfaces:**
- Documents: current visible email/search experience and dormant SMS backend capability.

- [ ] **Step 1: Update architecture truthfully**

Document `POST /api/rsvp/search`, exact invited-member matching, returned disclosure, cap/rate limits, KMS link recovery, and email-only recovery UI. Move SMS enrollment, preference, and Twilio details into a clearly labeled dormant-backend section and state that no website UI currently exposes them.

- [ ] **Step 2: Update launch checks**

Replace current SMS launch requirements with visible-flow checks for last-name result selection, no-match/too-many states, email recovery, and absence of SMS UI. Retain a separate optional re-enable checklist covering Twilio configuration and consent compliance.

- [ ] **Step 3: Check documentation diff**

Run: `git diff --check -- docs/ARCHITECTURE.md docs/LAUNCH_READINESS.md`

Expected: no whitespace errors and no statement that SMS is currently exposed through the website.

- [ ] **Step 4: Commit documentation**

```powershell
git add docs/ARCHITECTURE.md docs/LAUNCH_READINESS.md
git commit -m "docs: document RSVP search and dormant SMS support"
```

### Task 8: End-to-end and rendered UX verification

**Files:**
- Modify: `apps/web/e2e/home.spec.ts:1210-1455`
- Test: all changed test suites and browser flows

**Interfaces:**
- Verifies: public RSVP search, email recovery, legacy redirects, responsive behavior, and no visible SMS references.

- [ ] **Step 1: Read frontend testing skills before browser work**

Use `build-web-apps:frontend-testing-debugging` and `wedding-frontend-local-testing`. Confirm the in-app Browser tool is available, choose a fresh port as instructed, and ensure any server started for this task is shut down.

- [ ] **Step 2: Add failing e2e coverage**

Mock `POST **/api/rsvp/search` and cover exact submission, empty results, multiple household links, selection navigation, too-many guidance, and mobile layout. Replace phone recovery and SMS enrollment/preference scenarios with assertions that recovery is email-only and legacy paths redirect without SMS UI.

- [ ] **Step 3: Run the targeted e2e cases and resolve failures**

Run with a fresh port, for example:

```powershell
$env:E2E_PORT='5397'; npx playwright test apps/web/e2e/home.spec.ts --grep "RSVP search|recovery|legacy SMS|admin notification"
```

Expected: all targeted cases PASS.

- [ ] **Step 4: Perform rendered desktop and mobile review**

Inspect `/rsvp` at desktop and mobile widths using the in-app Browser. Verify visual hierarchy, focus order, one-panel-at-a-time behavior, long household names, 10 results, empty/too-many/error states, no horizontal overflow, and no visible SMS copy on public or admin pages.

- [ ] **Step 5: Run full automated verification**

Run in this order:

```powershell
npm run typecheck
npm test
npm run lint
npm run build -w apps/web
$env:E2E_PORT='5397'; npm run test:e2e
```

Expected: every command exits 0. If the web build regenerates unrelated responsive-image artifacts, restore only that generated churn without touching user changes.

- [ ] **Step 6: Audit the final visible surface and backend preservation**

Run:

```powershell
rg -n -i "sms|twilio|text updates|text message|mobile number" apps/web/src
rg -n "sms-subscriptions|sms-preferences|sendRecoverySms|sendSms" apps/api/src infra/lib packages/shared/src
git diff --check
git status --short
```

Expected: no user-visible SMS copy remains in active frontend components; backend SMS routes and delivery methods still exist; diff check passes; status contains only intentional files.

- [ ] **Step 7: Request independent code review**

Use `superpowers:requesting-code-review`. Require findings first, security/privacy review of search enumeration, test evidence, and a pass/fail decision. Address every required finding and repeat review when necessary.

- [ ] **Step 8: Commit final test adjustments**

```powershell
git add apps/web/e2e/home.spec.ts
git commit -m "test: cover RSVP search and hidden SMS UI"
```

- [ ] **Step 9: Finish the development branch**

Use `superpowers:verification-before-completion`, then `superpowers:finishing-a-development-branch`. Because this Codex worktree began detached, use the Codex App's Create branch control with suggested branch `codex/rsvp-search-hide-sms` before push/PR if native git branch creation remains unavailable.
