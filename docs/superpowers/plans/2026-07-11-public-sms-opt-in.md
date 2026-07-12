# Public SMS Opt-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the public proof page with a live `/sms-updates` form that any reviewer can submit to create durable consent and receive the Twilio confirmation message.

**Architecture:** Add a standalone SMS-subscription aggregate in the existing DynamoDB table, separate from households and RSVPs, and expose it through a throttled public API. Reuse the current consent copy, phone normalization, confirmation delivery, pending-to-active lifecycle, structured logging, and SPA patterns while preserving all invitation-scoped behavior.

**Tech Stack:** TypeScript 6, React 19, Zod, AWS Lambda/API Gateway/DynamoDB via CDK, Twilio REST delivery, Vitest, Testing Library, Playwright.

## Global Constraints

- Prioritize Twilio's review feedback: the public page must be live and submit end to end, not framed as proof or an example.
- The canonical public route is `/sms-updates`; `/sms-opt-in-proof` redirects there.
- The consent checkbox is optional participation, separate from RSVP, unchecked by default, and required only to submit this enrollment form.
- Keep the program limited to RSVP recovery, schedule updates, and wedding logistics.
- Keep Matt & Alison Wedding branding, Matthew Bulger ownership, `contact@matt-alison.com`, HELP/STOP, frequency, message/data rates, Terms, and Privacy visible.
- Do not log raw phone numbers or include them in DynamoDB keys.
- Preserve private RSVP, recovery authorization, household consent, email delivery, and admin household messaging behavior.
- Do not add a bulk-broadcast interface or deploy production infrastructure.

---

## File Map

- `packages/shared/src/index.ts`: public subscription schemas, response type, and `public_sms_opt_in` consent source.
- `packages/shared/src/index.test.ts`: schema and consent-source regression tests.
- `apps/api/src/repository.ts`: standalone subscription persistence and conditional activation.
- `apps/api/src/repository.test.ts`: DynamoDB command and in-memory lifecycle tests.
- `apps/api/src/service.ts`: validation, normalization, rate limits, delivery, and activation orchestration.
- `apps/api/src/service.test.ts`: service lifecycle, failure, and abuse-control tests.
- `apps/api/src/notifications.ts`: allow confirmation delivery without a household identifier while keeping safe logs.
- `apps/api/src/notifications.test.ts`: standalone confirmation logging/delivery coverage.
- `apps/api/src/handler.ts`: public route and stable route-name logging.
- `apps/api/src/handler.test.ts`: routing, source-IP forwarding, and log-redaction tests.
- `apps/web/src/api.ts`: typed public subscription request.
- `apps/web/src/pages/PublicPages.tsx`: live public form and submission states.
- `apps/web/src/pages/PublicPages.module.css`: responsive form presentation using existing tokens.
- `apps/web/src/App.tsx`: canonical route and legacy redirect.
- `apps/web/src/App.test.tsx`: route, form, copy, and redirect component tests.
- `apps/web/e2e/home.spec.ts`: browser-level public submission flow.
- `apps/web/src/components/SiteLayout.tsx`: replace obsolete route type with the canonical public route.
- `infra/lib/wedding-site-stack.ts`: API route and route-specific throttling.
- `infra/lib/wedding-site-stack.test.ts`: synthesized route and stage-setting assertions.
- `docs/ARCHITECTURE.md`: implemented standalone consent flow and data lifecycle.
- `docs/LAUNCH_READINESS.md`: canonical public URL and Twilio reviewer checklist.

---

### Task 1: Define the public subscription contract

**Files:**
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/index.test.ts`

**Interfaces:**
- Produces: `PublicSmsSubscriptionRequestSchema`, `PublicSmsSubscriptionRequest`, `PublicSmsSubscriptionResponseSchema`, `PublicSmsSubscriptionResponse`.
- Produces: `SmsConsentSource` value `public_sms_opt_in`.

- [ ] **Step 1: Write failing schema tests**

Add tests that accept `{ phone: '(480) 555-0100', consentAccepted: true }`, reject false or missing consent, reject unsupported phone characters, and parse `{ status: 'opted_in' }` as the public response.

```ts
expect(PublicSmsSubscriptionRequestSchema.safeParse({
  phone: '(480) 555-0100',
  consentAccepted: true,
}).success).toBe(true);
expect(PublicSmsSubscriptionRequestSchema.safeParse({
  phone: '(480) 555-0100',
  consentAccepted: false,
}).success).toBe(false);
```

- [ ] **Step 2: Verify the tests fail**

Run: `npm test -- packages/shared/src/index.test.ts`

Expected: FAIL because the public schemas and source do not exist.

- [ ] **Step 3: Add the shared types**

```ts
export const PublicSmsSubscriptionRequestSchema = z.object({
  phone: HouseholdPhoneInputSchema,
  consentAccepted: z.literal(true, {
    error: 'Confirm SMS consent to enable text updates.',
  }),
});
export type PublicSmsSubscriptionRequest = z.infer<
  typeof PublicSmsSubscriptionRequestSchema
>;

export const PublicSmsSubscriptionResponseSchema = z.object({
  status: z.enum(['pending_confirmation', 'opted_in']),
});
export type PublicSmsSubscriptionResponse = z.infer<
  typeof PublicSmsSubscriptionResponseSchema
>;
```

Extend `SmsConsentSourceSchema` with `'public_sms_opt_in'`.

- [ ] **Step 4: Verify the shared tests pass**

Run: `npm test -- packages/shared/src/index.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the contract**

```powershell
git add -- packages/shared/src/index.ts packages/shared/src/index.test.ts
git commit -m "Add public SMS subscription contract"
```

---

### Task 2: Persist standalone consent safely

**Files:**
- Modify: `apps/api/src/repository.ts`
- Test: `apps/api/src/repository.test.ts`

**Interfaces:**
- Produces: `SmsSubscription { subscriptionId: string; consent: SmsConsent; createdAt: string; updatedAt: string }`.
- Produces: `beginSmsSubscription(input)` and `activateSmsSubscription(input)` on `WeddingRepository`.
- Consumes: a peppered `subscriptionId` from the service; the repository never computes or receives a raw-phone key.

- [ ] **Step 1: Write failing repository lifecycle tests**

Cover DynamoDB `PutCommand`/`UpdateCommand` keys shaped as `SMS_SUBSCRIPTION#<subscriptionId>` with `sk: 'METADATA'`, pending persistence, conditional activation against pending status/phone/timestamp, conflict returns, and in-memory parity. Assert the raw phone is absent from `pk` and `sk`.

- [ ] **Step 2: Verify repository tests fail**

Run: `npm test -- apps/api/src/repository.test.ts`

Expected: FAIL because the subscription repository API does not exist.

- [ ] **Step 3: Implement the aggregate and atomic methods**

Add these repository interfaces:

```ts
export interface SmsSubscription {
  subscriptionId: string;
  consent: SmsConsent;
  createdAt: string;
  updatedAt: string;
}

beginSmsSubscription(input: SmsSubscription): Promise<void>;
activateSmsSubscription(input: {
  subscriptionId: string;
  expectedPending: SmsConsent;
  activatedAt: string;
}): Promise<SmsSubscription | undefined>;
```

Use a `PutCommand` for pending/re-consent writes and an `UpdateCommand` with conditions matching the exact pending status, phone, and consent timestamp for activation. Mirror behavior in `InMemoryWeddingRepository` with a dedicated map.

- [ ] **Step 4: Verify repository tests pass**

Run: `npm test -- apps/api/src/repository.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit persistence**

```powershell
git add -- apps/api/src/repository.ts apps/api/src/repository.test.ts
git commit -m "Persist standalone SMS consent"
```

---

### Task 3: Implement enrollment, delivery, and abuse controls

**Files:**
- Modify: `apps/api/src/service.ts`
- Modify: `apps/api/src/notifications.ts`
- Test: `apps/api/src/service.test.ts`
- Test: `apps/api/src/notifications.test.ts`

**Interfaces:**
- Produces: `WeddingService.createPublicSmsSubscription(input, { sourceIp })` returning `PublicSmsSubscriptionResponse`.
- Consumes: `PublicSmsSubscriptionRequestSchema`, repository lifecycle methods, and `sendSmsPreferenceConfirmation({ phone, subscriptionId })`.

- [ ] **Step 1: Write failing service and notification tests**

Test normalization to `+14805550100`, peppered deterministic ID generation, `public_sms_opt_in`, `pending_confirmation`, Twilio confirmation, conditional `opted_in` activation, pending preservation on provider failure, validation errors, per-phone limit 3/hour, per-IP limit 10/hour, and absence of raw phone in structured logs. Update the notification double so confirmation accepts either `householdId` or `subscriptionId` and logs only the identifier supplied.

- [ ] **Step 2: Verify focused tests fail**

Run: `npm test -- apps/api/src/service.test.ts apps/api/src/notifications.test.ts`

Expected: FAIL because public enrollment is not implemented.

- [ ] **Step 3: Add service orchestration**

Add one-hour constants and implement:

```ts
async createPublicSmsSubscription(
  input: unknown,
  requestContext: { sourceIp?: string },
): Promise<PublicSmsSubscriptionResponse>
```

Parse the request, normalize the phone, compute peppered hashes with distinct `sms-subscription-record`, `sms-subscription-phone-rate`, and `sms-subscription-ip-rate` namespaces, enforce limits using the existing expiring rate-limit repository method, write pending consent with `createSmsConsent(phone, 'public_sms_opt_in', now, 'pending_confirmation')`, send confirmation, and conditionally activate. Throw `PublicError('Too many SMS enrollment attempts. Try again later.', 429)` when limited and the existing provider-unavailable 503 on delivery failure.

- [ ] **Step 4: Generalize safe confirmation identity**

Change the messenger input to a discriminated identity without exposing phone:

```ts
type SmsPreferenceConfirmationInput =
  | { householdId: string; phone: string }
  | { subscriptionId: string; phone: string };
```

Structured logs include `householdId` or `subscriptionId`, never `phone`.

- [ ] **Step 5: Verify focused tests pass**

Run: `npm test -- apps/api/src/service.test.ts apps/api/src/notifications.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit service behavior**

```powershell
git add -- apps/api/src/service.ts apps/api/src/service.test.ts apps/api/src/notifications.ts apps/api/src/notifications.test.ts
git commit -m "Enroll public SMS subscribers"
```

---

### Task 4: Expose a stable public API route

**Files:**
- Modify: `apps/api/src/handler.ts`
- Test: `apps/api/src/handler.test.ts`
- Modify: `infra/lib/wedding-site-stack.ts`
- Test: `infra/lib/wedding-site-stack.test.ts`

**Interfaces:**
- Produces: `POST /api/sms-subscriptions`.
- Consumes: `WeddingService.createPublicSmsSubscription(input, { sourceIp })`.

- [ ] **Step 1: Write failing handler and synth tests**

Assert the handler forwards the parsed body and `event.requestContext.http.sourceIp`, resolves the stable route name `POST /sms-subscriptions`, returns service JSON, and never serializes the submitted phone into logs. Assert CDK creates the POST route, stage dependency, and settings with burst 3 and rate 1.

- [ ] **Step 2: Verify route tests fail**

Run: `npm test -- apps/api/src/handler.test.ts infra/lib/wedding-site-stack.test.ts`

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Implement the handler route**

Insert before RSVP routing:

```ts
if (method === 'POST' && path === '/sms-subscriptions') {
  return completeRequest(json(await service.createPublicSmsSubscription(body, {
    sourceIp: event.requestContext.http.sourceIp,
  })));
}
```

Extend the handler's service `Pick` and `resolveRouteName`.

- [ ] **Step 4: Add API Gateway route and throttle**

Create an `smsSubscriptionRoutes` POST route, include it in the default-stage dependency loop, and set `POST /api/sms-subscriptions` to `ThrottlingBurstLimit: 3` and `ThrottlingRateLimit: 1`.

- [ ] **Step 5: Verify route tests pass**

Run: `npm test -- apps/api/src/handler.test.ts infra/lib/wedding-site-stack.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the public endpoint**

```powershell
git add -- apps/api/src/handler.ts apps/api/src/handler.test.ts infra/lib/wedding-site-stack.ts infra/lib/wedding-site-stack.test.ts
git commit -m "Expose public SMS subscription endpoint"
```

---

### Task 5: Replace the proof page with the live branded form

**Files:**
- Modify: `apps/web/src/api.ts`
- Modify: `apps/web/src/pages/PublicPages.tsx`
- Modify: `apps/web/src/pages/PublicPages.module.css`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/SiteLayout.tsx`
- Test: `apps/web/src/App.test.tsx`

**Interfaces:**
- Produces: `createPublicSmsSubscription(payload)` in the web API client.
- Produces: `SmsUpdatesPage` at `/sms-updates`.
- Consumes: `SmsConsentCheckboxField` and the public request/response contract.

- [ ] **Step 1: Write failing component and routing tests**

Mock the API client and assert: heading `Wedding text updates`; empty phone; unchecked checkbox; visible program scope, frequency, rates, HELP/STOP, operator identity, email, Terms, and Privacy; no proof/example/non-enrollment language; consentless submit shows an error and makes no request; checked submit calls `{ phone, consentAccepted: true }`; success says `Text updates are active`; provider failure leaves a retry path; `/sms-opt-in-proof` calls `window.location.replace('/sms-updates')`.

- [ ] **Step 2: Verify component tests fail**

Run: `npm test -- apps/web/src/App.test.tsx`

Expected: FAIL against the non-submitting proof page.

- [ ] **Step 3: Add the typed API client**

```ts
export function createPublicSmsSubscription(
  payload: PublicSmsSubscriptionRequest,
): Promise<PublicSmsSubscriptionResponse> {
  return request('/sms-subscriptions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
```

- [ ] **Step 4: Implement the live page**

Rename the component to `SmsUpdatesPage`. Use controlled `phone`, `consentAccepted`, `status`, `consentError`, and `message` state. Keep the checkbox unchecked after initial render and reset it after success. Submit only after affirmative consent; render direct Terms/Privacy links through `SmsConsentCheckboxField`. Use public copy that accurately describes enrollment and the separate RSVP relationship.

- [ ] **Step 5: Update canonical and legacy routing**

Replace `sms_opt_in_proof` with `sms_updates`. Parse `/sms-updates` as the page. For `/sms-opt-in-proof`, render a small redirect component whose effect calls `window.location.replace('/sms-updates')`, without rendering obsolete proof content.

- [ ] **Step 6: Style responsive states**

Replace `.proof-*` selectors with `.sms-updates-*` selectors. Keep the form one column at narrow widths, preserve visible focus/error states, and use existing `lookup-card`, button, spacing, and typography patterns.

- [ ] **Step 7: Verify component tests pass**

Run: `npm test -- apps/web/src/App.test.tsx`

Expected: PASS.

- [ ] **Step 8: Commit the public UI**

```powershell
git add -- apps/web/src/api.ts apps/web/src/pages/PublicPages.tsx apps/web/src/pages/PublicPages.module.css apps/web/src/App.tsx apps/web/src/App.test.tsx apps/web/src/components/SiteLayout.tsx
git commit -m "Replace SMS proof with live opt-in"
```

---

### Task 6: Prove the reviewer-visible flow and update launch documentation

**Files:**
- Modify: `apps/web/e2e/home.spec.ts`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/LAUNCH_READINESS.md`

**Interfaces:**
- Consumes: canonical `/sms-updates` page and `POST /api/sms-subscriptions`.

- [ ] **Step 1: Replace the proof E2E with a failing live-flow test**

Intercept `**/api/sms-subscriptions`, assert POST body `{ phone: '(480) 555-0100', consentAccepted: true }`, return `{ status: 'opted_in' }`, and exercise the page from empty/unchecked state through visible success. Assert Terms and Privacy links and prohibited-copy absence. Add a legacy-route redirect assertion.

- [ ] **Step 2: Verify the E2E test fails before final wiring**

Run with a fresh port:

```powershell
$listener = [System.Net.Sockets.TcpListener]::new([Net.IPAddress]::Parse('127.0.0.1'), 0)
$listener.Start(); $port = $listener.LocalEndpoint.Port; $listener.Stop()
$env:E2E_PORT = "$port"
npx playwright test apps/web/e2e/home.spec.ts --grep "public SMS"
Remove-Item Env:\E2E_PORT -ErrorAction SilentlyContinue
```

Expected: FAIL until the final route/UI wiring is complete.

- [ ] **Step 3: Update current-state documentation**

Document standalone records, pending-to-active delivery, rate limits, the canonical URL, and the explicit Twilio review checklist. Remove launch references to `/sms-opt-in-proof`.

- [ ] **Step 4: Run focused and full verification**

```powershell
npm run typecheck
npm run lint
npm test
npm run build -w apps/web
$env:E2E_PORT = "$port"
npm run test:e2e
Remove-Item Env:\E2E_PORT -ErrorAction SilentlyContinue
Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort $port -State Listen -ErrorAction SilentlyContinue
```

Expected: all commands PASS and no listener remains on the selected port.

- [ ] **Step 5: Perform manual browser verification**

Start the repository helper on its fresh assigned port, inspect `/sms-updates` at desktop and narrow viewport, submit a mocked enrollment, verify the legacy redirect, capture the browser result, stop the helper with its state file, and confirm its port is closed.

- [ ] **Step 6: Scan for obsolete public framing**

Run:

```powershell
rg -n -i "SMS opt-in proof|non-submitting example|does not submit|does not enroll|sms-opt-in-proof" apps docs --glob '!docs/superpowers/**'
```

Expected: only the intentional legacy redirect/test may reference `sms-opt-in-proof`; no user-facing or launch-document proof/example language remains.

- [ ] **Step 7: Commit verification coverage and docs**

```powershell
git add -- apps/web/e2e/home.spec.ts docs/ARCHITECTURE.md docs/LAUNCH_READINESS.md
git commit -m "Verify public SMS opt-in flow"
```

---

### Task 7: Independent review and PR readiness

**Files:**
- Review all changes from `e7b5ee2..HEAD`.

**Interfaces:**
- Produces: reviewer pass/fail, final verification evidence, and draft PR.

- [ ] **Step 1: Review against every Twilio acceptance criterion**

Confirm public access, phone entry, unchecked consent, actual submission, RSVP separation, branding/contact identity, program scope, HELP/STOP, frequency/rates, Terms/Privacy, and removal of proof/example language.

- [ ] **Step 2: Review security and regressions**

Confirm no raw phones in keys/logs, rate limits cover phone/IP, provider failure remains pending, activation is conditional, and private household authorization is unchanged.

- [ ] **Step 3: Run final clean-state verification**

Run `git diff --check`, `git status --short`, focused tests for every changed layer, then the full commands from Task 6. Treat any skipped check as a failure requiring an explicit fix or user-approved risk.

- [ ] **Step 4: Push and open a draft PR**

Push `codex/public-sms-opt-in` and create a draft PR whose body lists the Twilio-driven behavior, test commands/results, reviewer decision, deployment note, and the manual step to send the live URL to the Twilio representative after deployment.

