# Compact Carousel Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the growing dot strip with compact accessible pagination while preserving the native carousel interaction model.

**Architecture:** Keep `activeIndex` and the existing native scroll-snap controller as the source of truth. Render a derived count and progress percentage beneath a full-width caption; validate the user-visible contract through the existing Playwright coverage.

**Tech Stack:** React 19, TypeScript, CSS Modules, Playwright, Vite.

## Global Constraints

- Do not add a carousel dependency or modify native swipe, scroll snap, wheel throttling, arrow navigation, or responsive image delivery.
- Preserve unrelated uncommitted changes in `PublicPages.tsx`, `home.spec.ts`, `siteContent.ts`, and `.codex-dev-server.log`.
- Use a fresh local port for every E2E or browser run and stop each server before completion.

---

### Task 1: Compact carousel pagination

**Files:**
- Modify: `apps/web/e2e/home.spec.ts`
- Modify: `apps/web/src/pages/PublicPages.tsx`
- Modify: `apps/web/src/pages/PublicPages.module.css`
- Modify: `apps/web/src/styles.css`

**Interfaces:**
- Consumes: `activeIndex`, `photos.length`, and the existing native carousel navigation handlers.
- Produces: an accessible `Photo position` status and decorative progress fill synchronized with the active slide.

- [ ] **Step 1: Write the failing behavior tests**

Replace dot-width assertions with Playwright checks that the count reads `1 of <slide count>`, native swipe changes it to `2 of <slide count>`, arrow navigation changes it to `3 of <slide count>`, and progress width matches the current slide ratio. Add 1024 by 800 and 390 by 844 layout assertions that the caption owns the caption-row width and the page has no horizontal overflow.

- [ ] **Step 2: Run the focused tests and verify RED**

Run `npx playwright test apps/web/e2e/home.spec.ts --project=chromium --grep "photo carousel"` with a fresh `E2E_PORT`. Expected: failure because `Photo position` and progress markup do not exist and the caption is compressed.

- [ ] **Step 3: Implement the minimal markup and styles**

Replace dot buttons with a polite atomic status showing `{activeIndex + 1} of {photos.length}` and an `aria-hidden` track whose fill width is `${((activeIndex + 1) / photos.length) * 100}%`. Make the caption row one column, add a compact count-plus-track pagination row, remove obsolete dot styles and button exceptions, and rename the theme token to `--photo-progress-bg`.

- [ ] **Step 4: Verify GREEN and quality gates**

Run the focused carousel E2E tests, Prettier check, targeted ESLint, web typecheck, web build, and then the full E2E suite on fresh ports. Confirm no test server remains listening and inspect generated-file churn.

- [ ] **Step 5: Perform responsive browser QA**

Use the in-app browser at 1280 by 900, 1024 by 800, 560 by 844, and 390 by 844. Verify page identity, no framework overlay, clean console, full-width captions, contained pagination, correct count/progress updates, swipe and arrow interaction, and no horizontal overflow.

- [ ] **Step 6: Review and commit only scoped hunks**

Run `git diff --check`, complete independent review, address findings, and ensure staged changes exclude all pre-existing unrelated hunks.

