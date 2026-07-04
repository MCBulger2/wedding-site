# Wedding Website Project Plan

## Summary

Build a private GitHub repository containing a React + Vite wedding website, an AWS CDK TypeScript infrastructure app, and a small serverless RSVP backend.

Recommended AWS architecture:

- Frontend: React + Vite SPA hosted from private S3 behind CloudFront, with Route 53 and ACM for the custom domain.
- Backend: API Gateway HTTP API, Lambda, and DynamoDB on-demand.
- RSVP access: unique invite code or QR link per household, with no guest passwords.
- Admin: protected admin area for managing guests, viewing RSVPs, and exporting CSV.
- Infrastructure: AWS CDK v2 in TypeScript, deployed by GitHub Actions using OIDC rather than long-lived AWS keys.

## Repository Structure

Use a simple TypeScript monorepo:

- `apps/web`: React + Vite frontend.
- `apps/api`: Lambda handlers, shared validation, and RSVP business logic.
- `infra`: AWS CDK app defining all AWS resources.
- `packages/shared`: shared TypeScript types and validation schemas.
- `.github/workflows`: CI and deployment workflows for staging and production.

Use two environments:

- `staging`: deployed automatically from `main` after changes merge.
- `production`: deployed automatically when a non-prerelease GitHub Release is published for a tested `v*` tag whose commit is already on `main`.

## Application Design

### Public Homepage

The homepage should include:

- Wedding announcement.
- Couple names.
- Date or year.
- Location.
- Schedule when ready.
- Travel and lodging details when ready.
- FAQ.
- Photo gallery.

Do not render sensitive guest data on public pages. Static wedding content can start as local JSON or MDX so updates remain cheap and deployable.

### Guest RSVP Flow

Mailed invites should include a short URL or QR code like `/rsvp/{inviteCode}`.

Guest RSVP behavior:

- Each household receives one high-entropy invite code.
- The backend stores a hash of the invite code for guest lookup and may store a KMS-encrypted ciphertext copy for admin-only recovery, exports, invitation emails, and lost-code recovery delivery to stored household contacts.
- Guests can view and edit the household RSVP using the same invite code.
- The RSVP form should support household members, attendance, meal choice, plus-one rules, notes, accessibility or dietary notes, and timestamped edits.
- Invalid codes should return a generic message that does not reveal whether a household exists.

### Admin Flow

Admin functionality should include:

- Admin login through Cognito User Pool with MFA enabled.
- Guest and household management.
- Invite-code generation.
- Invitation lifecycle tracking from generation through export, mailing, and archive.
- Invitation mailing CSV export with RSVP URLs and QR-code data URLs.
- Admin-only reveal, email, and re-send actions for household invitations.
- RSVP search and filtering.
- CSV import for guest data.
- CSV export for RSVP data.

Admin API routes must require Cognito JWT authorization. Guest RSVP routes should use invite-code authorization, rate limits, and strict request validation.

## AWS Infrastructure

### Frontend Hosting

- Private S3 bucket for built Vite assets.
- CloudFront distribution with Origin Access Control.
- Route 53 aliases for the selected custom domain.
- ACM certificate for HTTPS.
- SPA fallback routing to `index.html`.
- Security headers including HSTS, X-Content-Type-Options, frame protections, referrer policy, and a conservative Content Security Policy.
- CloudFront access logs for production if budget allows.

### Backend

- API Gateway HTTP API for low-cost Lambda-backed endpoints.
- Node.js and TypeScript Lambda handlers.
- DynamoDB on-demand table with point-in-time recovery enabled.
- Secrets Manager secret for invite-code hashing pepper.
- KMS key for encrypted recoverable invite codes.
- CloudWatch logs with explicit retention.
- AWS WAF on CloudFront for managed rules and rate limiting.

### Data Model

Use DynamoDB with a small number of access patterns:

- `Household` items keyed by `householdId`.
- `InviteCodeLookup` items keyed by `inviteCodeHash`, pointing to `householdId`.
- `InviteCodeSecret` items keyed by `householdId`, containing only encrypted invite-code ciphertext plus the matching hash.
- RSVP data stored with household member responses, edit metadata, and audit timestamps.
- Optional GSI for admin views by RSVP status.

### IAM And Deployment Security

- GitHub Actions uses AWS OIDC role assumption.
- No static AWS access keys in GitHub secrets.
- Least-privilege roles for deploy, Lambda runtime, and CI.
- S3 public access blocked.
- DynamoDB access restricted to required Lambda actions.
- Environment variables contain resource names only; secrets stay in Secrets Manager and invite-code plaintext is never stored in env vars.

## Implementation Steps

1. Initialize private GitHub repo, branch protection, required PR checks, Dependabot, secret scanning, and CODEOWNERS.
2. Scaffold monorepo with Vite React, TypeScript API package, CDK app, ESLint, Prettier, Vitest, and Playwright.
3. Build CDK stacks for hosted zone lookup, certificate, S3, CloudFront, API Gateway, Lambda, DynamoDB, Cognito, WAF, logs, and deployment outputs.
4. Build frontend homepage, RSVP entry/view/edit flow, admin login, admin dashboard, guest editor, and CSV export.
5. Build backend RSVP and admin endpoints.
6. Add guest CSV import format and deterministic validation errors before any data is written.
7. Add CI workflow for typecheck, lint, unit tests, API tests, frontend build, CDK synth, and Playwright smoke tests.
8. Add deploy workflow that deploys staging from `main` and gates GitHub Release-based production promotion through the production GitHub environment.
9. Run security review before launch: WAF and rate limits, IAM/KMS review, no logged or raw-stored plaintext invite codes, HTTPS-only, admin MFA, and DynamoDB point-in-time recovery.
10. Do final launch rehearsal with test households before printing mailed invite URLs and QR codes.

## API Surface

Initial backend endpoints:

- `GET /rsvp/{inviteCode}`: view the household RSVP for a valid invite code.
- `PUT /rsvp/{inviteCode}`: create or update the household RSVP for a valid invite code.
- `GET /admin/households`: list households for authenticated admins.
- `PUT /admin/households/{id}`: update household display, contact, plus-one, and mailing fields.
- `DELETE /admin/households/{id}`: archive a household.
- `PUT /admin/households/{id}/members/{memberId}`: update a household member without changing the stable member ID.
- `DELETE /admin/households/{id}/members/{memberId}`: remove or archive a member depending on RSVP history.
- `POST /admin/households/import`: import household data from CSV for authenticated admins.
- `POST /admin/households/{id}/invite-code`: generate or rotate an invite code for authenticated admins.
- `GET /admin/households/{id}/invitation`: reveal the current recoverable invite code and RSVP URL for authenticated admins.
- `POST /admin/households/{id}/invitation-email`: send or re-send a household invitation email for authenticated admins.
- `PUT /admin/households/{id}/invite-lifecycle`: mark invitations exported, sent, or archived.
- `GET /admin/invitations/export`: export invitation mailing CSV for authenticated admins.
- `POST /admin/invitations/email`: send invitation emails in bulk for authenticated admins.
- `GET /admin/rsvps/export`: export RSVP data as CSV for authenticated admins.

## Invitation Export Format

The first invitation mailing export is CSV. Each row includes household display name, admin-only mailing address fields, invite lifecycle status and timestamps, a direct RSVP URL, and a QR-code PNG data URL.

Production invite codes are never persisted as raw plaintext. Generation stores the hash for RSVP lookup and a KMS-encrypted ciphertext copy for authenticated admin reveal/export/email workflows plus lost-code recovery sent to a stored household email address or mobile number. Exports and email re-sends reuse the recoverable code instead of rotating URLs. Once a household is marked `sent`, dashboard invite-code rotation is blocked to protect mailed RSVP URLs.

## Testing Plan

Unit tests should cover:

- Invite-code generation, hashing, encrypted recovery, and plaintext non-leakage in normal household responses.
- RSVP validation rules.
- Household import validation.
- Admin authorization checks.
- Backend business logic.
- DynamoDB repository behavior using mocked AWS SDK clients.

Integration tests should cover:

- Valid invite code can view and update RSVP.
- Invalid invite code fails generically.
- Guest cannot access admin endpoints.
- Admin can import, list, edit, and export RSVPs.
- Duplicate imports are rejected or handled predictably.

End-to-end tests should cover:

- Homepage renders on mobile and desktop.
- RSVP form supports edit-after-submit.
- Admin dashboard filters and CSV export work.
- Direct SPA routes work after page refresh.

Deployment checks should cover:

- `cdk synth` passes.
- Staging deploy completes from `main`.
- Production deploy promotes a `v*` GitHub Release tag whose commit is already on `main` without redeploying staging.
- HTTPS certificate validates.
- Route 53 aliases resolve.
- CloudFront serves current assets.
- API CORS allows only configured frontend origins.

Use Playwright MCP to interact with and debug the UI when visual or interaction behavior is involved.

## Assumptions

- GitHub private repo is acceptable.
- AWS region defaults to `us-west-1` for app resources, with ACM certificate in `us-east-1` as needed for CloudFront.
- RSVP access uses mailed invite codes rather than guest-created accounts.
- Admin access uses Cognito with MFA.
- Cost is optimized for low traffic and low operations: serverless, on-demand DynamoDB, no containers, and no always-on database.
- Photos are static optimized web assets in the frontend or S3 deployment unless a richer gallery CMS is requested later.
