# Footer Contact Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the shared footer brand to `Matt & Alison Wedding` and add the configured contact email as a clickable link.

**Architecture:** Keep the change inside the existing shared `SiteFooter` component. Reuse `siteContent.contact.email` and `siteContent.contact.href` so the footer follows the same build-time environment override as the FAQ, and extend existing Playwright coverage across public, RSVP, and admin routes.

**Tech Stack:** React 19, TypeScript 6, CSS Modules, Vite 8, Playwright 1.61

## Global Constraints

- The footer identity must read exactly `Matt & Alison Wedding`.
- The email must be a clickable `mailto:` link sourced from `siteContent.contact`.
- Keep the wedding date sourced from `siteContent.dateLabel`.
- Do not change the homepage heading, contact configuration, legal links, or conditional Admin link.
- Preserve the existing responsive footer layout and add no dependencies.

---

### Task 1: Publish the wedding brand and contact email in the shared footer

**Files:**
- Modify: `apps/web/e2e/home.spec.ts:905`
- Modify: `apps/web/src/components/SiteLayout.tsx:80`
- Modify: `apps/web/src/components/SiteLayout.module.css:103`

**Interfaces:**
- Consumes: `siteContent.dateLabel: string`, `siteContent.contact.email: string`, and `siteContent.contact.href: string` from `apps/web/src/siteContent.ts`.
- Produces: Shared footer markup containing the exact brand text and an environment-aware contact link on every route using `SiteFooter`.

- [ ] **Step 1: Extend the footer end-to-end test so it fails for the missing brand and email**

In `apps/web/e2e/home.spec.ts`, update the existing mobile footer test loop immediately after `const footerLinks = ...`:

```ts
    const footer = page.getByRole('contentinfo');
    const footerLinks = footer.getByRole('link', {
      name: /^(Terms|Privacy|Admin)$/,
    });
    await expect(footer).toContainText('Matt & Alison Wedding');
    await expect(
      footer.getByRole('link', { name: 'contact@matt-alison.com' }),
    ).toHaveAttribute('href', 'mailto:contact@matt-alison.com');
    await expect(footer.getByRole('link', { name: 'Terms' })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Privacy' })).toBeVisible();
```

- [ ] **Step 2: Run the focused test and verify the new assertion fails**

Run:

```powershell
$listener = [System.Net.Sockets.TcpListener]::new([Net.IPAddress]::Parse('127.0.0.1'), 0)
$listener.Start()
$port = $listener.LocalEndpoint.Port
$listener.Stop()
$env:E2E_PORT="$port"
npx playwright test apps/web/e2e/home.spec.ts --grep "mobile footer links stay aligned"
Remove-Item Env:\E2E_PORT -ErrorAction SilentlyContinue
```

Expected: FAIL because the footer does not contain `Matt & Alison Wedding` and has no `contact@matt-alison.com` link.

- [ ] **Step 3: Implement the minimal shared footer markup**

In `apps/web/src/components/SiteLayout.tsx`, replace the current leading `<span>` with:

```tsx
      <span className={scoped(styles, 'footer-details')}>
        <span>Matt &amp; Alison Wedding · {siteContent.dateLabel}</span>
        <a href={siteContent.contact.href}>
          <span aria-hidden="true">· </span>
          {siteContent.contact.email}
        </a>
      </span>
```

In `apps/web/src/components/SiteLayout.module.css`, add:

```css
.footer-details {
  flex-wrap: wrap;
  gap: 0.3rem;
}
```

and add `.footer-details` to the existing selector group that applies `align-items: center` and `display: flex`.

- [ ] **Step 4: Run focused and static checks**

Run:

```powershell
$listener = [System.Net.Sockets.TcpListener]::new([Net.IPAddress]::Parse('127.0.0.1'), 0)
$listener.Start()
$port = $listener.LocalEndpoint.Port
$listener.Stop()
$env:E2E_PORT="$port"
npx playwright test apps/web/e2e/home.spec.ts --grep "mobile footer links stay aligned"
Remove-Item Env:\E2E_PORT -ErrorAction SilentlyContinue
npm run typecheck
npm run lint
```

Expected: the focused Playwright test passes on all three routes; TypeScript and ESLint exit with code 0.

- [ ] **Step 5: Perform rendered desktop and mobile verification**

Start the Vite app on an unused port with `VITE_ENABLE_LOCAL_ADMIN_MOCKS=true` and inspect `/`, `/rsvp`, and `/admin` at 1440x900 and 390x844. Confirm:

- `Matt & Alison Wedding`, the date, and the clickable contact email are visible.
- Footer content wraps without overlap or horizontal scrolling.
- Terms, Privacy, and Admin alignment remains intact.
- The RSVP footer still reaches the viewport bottom on a tall viewport.

- [ ] **Step 6: Run the full frontend end-to-end suite**

Run:

```powershell
$listener = [System.Net.Sockets.TcpListener]::new([Net.IPAddress]::Parse('127.0.0.1'), 0)
$listener.Start()
$port = $listener.LocalEndpoint.Port
$listener.Stop()
$env:E2E_PORT="$port"
npm run test:e2e
Remove-Item Env:\E2E_PORT -ErrorAction SilentlyContinue
```

Expected: all Playwright tests pass.

- [ ] **Step 7: Commit the implementation**

```powershell
git add -- apps/web/e2e/home.spec.ts apps/web/src/components/SiteLayout.tsx apps/web/src/components/SiteLayout.module.css
git commit -m "feat: add contact email to footer"
```
