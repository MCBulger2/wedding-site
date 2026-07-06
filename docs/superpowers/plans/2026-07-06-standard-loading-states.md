# Standard Loading States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize web loading and fallback UI with skeletons where useful and one silent loading animation everywhere else.

**Architecture:** Extract shared loading primitives in `apps/web/src/components/LoadingStates.tsx`, reuse existing global CSS classes, and replace duplicated RSVP/admin loading components. Keep behavior scoped to presentation; do not alter API state machines.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Vite, Playwright.

---

### Task 1: Shared Loading Primitives

**Files:**
- Create: `apps/web/src/components/LoadingStates.tsx`
- Create: `apps/web/src/components/LoadingStates.test.tsx`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Write failing tests**

Create tests that import `LoadingPulse`, `LoadingScreen`, and `RouteLoadingFallback`. Assert the rendered output contains no visible `Loading`, `Preparing`, `Refreshing`, `Saving`, `Generating`, or `Opening` copy, and that skeleton elements are marked `aria-hidden="true"`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- apps/web/src/components/LoadingStates.test.tsx`

Expected: FAIL because `LoadingStates.tsx` does not exist yet.

- [ ] **Step 3: Implement minimal shared components**

Create `LoadingStates.tsx` with silent components using existing CSS classes: `loading-pulse`, `loading-mark`, `loading-card`, `skeleton-stack`, `skeleton-line`, `skeleton-button`, `skeleton-row`, and `admin-skeleton`.

- [ ] **Step 4: Replace route fallbacks**

Update `App.tsx` so every `Suspense` fallback renders `<RouteLoadingFallback />` instead of `<main className="page-shell">Loading...</main>`.

- [ ] **Step 5: Verify task tests pass**

Run: `npm test -- apps/web/src/components/LoadingStates.test.tsx apps/web/src/App.test.tsx`

Expected: PASS.

### Task 2: RSVP Loading States

**Files:**
- Modify: `apps/web/src/pages/RsvpPages.tsx`
- Modify: `apps/web/src/pages/RsvpPages.test.tsx`

- [ ] **Step 1: Write failing tests**

Add tests that render long-running RSVP lookup/submission states and long-running RSVP page load states. Assert loading/fallback regions do not visibly render loading copy such as `Opening your RSVP`, `Loading your RSVP`, `Saving your RSVP`, or `Sending your RSVP link`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- apps/web/src/pages/RsvpPages.test.tsx`

Expected: FAIL against the current local `LoadingPulse` and `LoadingScreen` copy.

- [ ] **Step 3: Use shared silent components**

Import `LoadingPulse` and `LoadingScreen` from `../components/LoadingStates.js`. Replace the local `LoadingScreen` and `LoadingPulse` implementations and pass no visible label/message props. Keep RSVP form and button labels unchanged.

- [ ] **Step 4: Verify RSVP tests pass**

Run: `npm test -- apps/web/src/pages/RsvpPages.test.tsx`

Expected: PASS.

### Task 3: Admin Loading States

**Files:**
- Modify: `apps/web/src/pages/AdminPage.tsx`
- Modify: `apps/web/src/App.test.tsx`

- [ ] **Step 1: Write failing tests**

Add or update tests that cover admin loading components through exported/shared primitives or initial admin loading UI. Assert visible loading copy such as `Preparing sign-in`, `Generating QR code`, and `Refreshing dashboard` is not rendered in loading/fallback regions.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- apps/web/src/App.test.tsx`

Expected: FAIL against the duplicated admin loading components or current visible copy.

- [ ] **Step 3: Use shared silent components and skeletons**

Import shared loading components from `../components/LoadingStates.js`. Replace the local `LoadingScreen`, `LoadingPulse`, `SkeletonStat`, and `AdminDashboardSkeleton` implementations. Preserve admin dashboard layout and CSS module class usage.

- [ ] **Step 4: Verify admin tests pass**

Run: `npm test -- apps/web/src/App.test.tsx`

Expected: PASS.

### Task 4: Full Verification And Visual QA

**Files:**
- No source edits unless verification finds a defect.

- [ ] **Step 1: Run code-level checks**

Run:

```powershell
npm run typecheck
npm test
npm run build -w apps/web
```

Expected: all commands exit 0.

- [ ] **Step 2: Run rendered frontend verification**

Use a fresh `E2E_PORT` and run:

```powershell
$env:E2E_PORT = "<fresh-port>"
npm run test:e2e
Remove-Item Env:\E2E_PORT -ErrorAction SilentlyContinue
```

Expected: Playwright suite passes. If manual browser inspection is needed, start the wedding frontend helper on a fresh port and stop it before final response.

- [ ] **Step 3: Review final diff**

Check that no visible loading copy remains in fallback/loading regions, no unrelated files changed, and no scratch `.superpowers` files remain.
