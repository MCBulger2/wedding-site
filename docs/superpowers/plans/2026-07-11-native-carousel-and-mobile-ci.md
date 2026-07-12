# Native Carousel Input and Mobile CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the two conditional end-to-end test skips by exercising native carousel input and the full admin workflow in both configured browser projects, and make GitHub Actions verify both projects.

**Architecture:** Keep the carousel native: CSS owns touch panning and scroll snap while React derives active state from settled scroll position. Playwright will send trusted Chromium touch and wheel input rather than synthetic DOM events. The admin scenario will select its visible household representation (desktop table or mobile card) without changing production behavior.

**Tech Stack:** React 19, TypeScript, Playwright Chromium/CDP, GitHub Actions.

## Global Constraints

- Do not replace native carousel scrolling with custom pointer-drag code.
- Preserve the wheel accumulation threshold (90px) and navigation interval (450ms).
- Both configured Playwright projects, `chromium` and `mobile`, must complete with zero skipped tests.
- Use only existing mock household data; never add real guest or invitation data.
- Build responsive images before interpreting web-build output; revert unrelated generated asset churn.

---

## File Map

- `apps/web/e2e/home.spec.ts`: trusted carousel gestures and project-neutral admin workflow locators.
- `.github/workflows/ci.yml`: explicit Chromium and Pixel 7 Playwright verification.
- `scripts/report-github-test-results.mjs`: separate desktop and mobile E2E summary rows.
- `scripts/report-github-test-results.test.mjs`: summary coverage for both E2E report paths.

### Task 1: Prove native carousel input in both projects

**Files:**
- Modify: `apps/web/e2e/home.spec.ts`

**Interfaces:**
- Produces: a test-local `swipeScroller(page, scroller)` helper that sends a leftward trusted touch sequence through Chromium CDP.
- Consumes: the existing `photo-carousel-scroller` test id and active caption/dot controls.

- [ ] **Step 1: Write the failing interaction assertions**

Remove the capability skip from the carousel test. Assert that a leftward touch gesture advances the scroller, the active caption becomes `secondGalleryPhoto.caption`, and the next dot has `aria-current="true"`. Replace synthetic wheel dispatch with a real horizontal `page.mouse.wheel(deltaX, 0)` while the carousel is under the pointer.

- [ ] **Step 2: Verify the test fails for the intended reason**

Run with a fresh port:

```powershell
$listener = [System.Net.Sockets.TcpListener]::new([Net.IPAddress]::Parse('127.0.0.1'), 0)
$listener.Start(); $port = $listener.LocalEndpoint.Port; $listener.Stop()
$env:E2E_PORT = "$port"; $env:CI = '1'
npx playwright test apps/web/e2e/home.spec.ts --project=mobile --grep "photo carousel"
```

Expected: the added trusted-touch assertion fails before the gesture helper is added or before the assertion targets the settled native state.

- [ ] **Step 3: Add the minimal trusted-input helpers**

Use `page.context().newCDPSession(page)` and send `Input.dispatchTouchEvent` for `touchStart`, multiple leftward `touchMove` points inside the scroller, then `touchEnd`. Use `page.mouse.move()` before `page.mouse.wheel()` so the wheel event reaches the carousel. Keep the existing `Date.now` hook only for deterministic throttle assertions.

- [ ] **Step 4: Verify both projects pass without skips**

```powershell
npx playwright test apps/web/e2e/home.spec.ts --project=chromium --project=mobile --grep "photo carousel"
```

Expected: all matching carousel tests pass and no matching test is skipped.

### Task 2: Run the real admin workflow on desktop and mobile

**Files:**
- Modify: `apps/web/e2e/home.spec.ts`

**Interfaces:**
- Produces: test-local lookup of a visible desktop household row or mobile household card for a named household.
- Consumes: existing desktop `Households table` and mobile `Households` card semantics.

- [ ] **Step 1: Remove the failing project skip and assert equivalent mobile surfaces**

Remove `testInfo` and `test.skip` from `admin route is reachable, can create households, and shows RSVP results`. Introduce helpers that scope follow-up locators to the visible table row in Chromium and the visible mobile `article` card in the mobile project.

- [ ] **Step 2: Verify the mobile workflow fails against desktop-only locators**

```powershell
npx playwright test apps/web/e2e/home.spec.ts --project=mobile --grep "admin route is reachable"
```

Expected: failure on the first desktop-table-specific locator before the project-neutral helper is applied.

- [ ] **Step 3: Implement the smallest project-neutral locator change**

Use the existing mobile card controls/actions instead of changing production admin UI. Branch only where a table-only control has no matching card semantics; retain all creation, invitation, edit, archive, reload, and RSVP result assertions.

- [ ] **Step 4: Verify the scenario in both projects**

```powershell
npx playwright test apps/web/e2e/home.spec.ts --project=chromium --project=mobile --grep "admin route is reachable|admin mobile"
```

Expected: all matching tests pass and no matching test is skipped.

### Task 3: Verify both browser projects in GitHub Actions

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `scripts/report-github-test-results.mjs`
- Modify: `scripts/report-github-test-results.test.mjs`

**Interfaces:**
- Produces: separate JUnit result files for `chromium` and `mobile` without overwriting either report.
- Consumes: the existing Playwright browser installation and `report:ci` summary step.

- [ ] **Step 1: Add an explicit mobile verification command**

Keep the existing Chromium command and add:

```yaml
- run: npm run test:e2e -- --project=mobile --reporter=line,junit,html
  env:
    PLAYWRIGHT_JUNIT_OUTPUT_NAME: reports/playwright-mobile-junit.xml
```

Rename the existing Chromium report to `reports/playwright-chromium-junit.xml` so both are retained.

- [ ] **Step 2: Preserve both projects in the generated CI summary**

Replace the single default E2E report definition with separate `E2E Chromium` and `E2E Mobile` entries for `reports/playwright-chromium-junit.xml` and `reports/playwright-mobile-junit.xml`. Extend the script test fixture so the Markdown output contains both independent rows and their skipped totals.

- [ ] **Step 3: Validate the workflow configuration and repository quality gates**

```powershell
git diff --check
npm run typecheck
npm test
npm run lint
npm run build -w apps/web
```

- [ ] **Step 4: Run the full browser matrix locally**

```powershell
$listener = [System.Net.Sockets.TcpListener]::new([Net.IPAddress]::Parse('127.0.0.1'), 0)
$listener.Start(); $port = $listener.LocalEndpoint.Port; $listener.Stop()
$env:E2E_PORT = "$port"; $env:CI = '1'
npm run test:e2e
Remove-Item Env:\E2E_PORT, Env:\CI -ErrorAction SilentlyContinue
Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort $port -State Listen -ErrorAction SilentlyContinue
```

Expected: 66 passed, 0 skipped, and no remaining listener.
