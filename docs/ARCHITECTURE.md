# Wedding Site Architecture

This document describes the current implemented shape of the repository and the constraints it is meant to preserve.

## Overview

The project is a TypeScript monorepo for Matt and Alison's wedding site. It combines:

- a public wedding website,
- a private household RSVP flow,
- an admin dashboard for invitation and household management,
- and AWS CDK infrastructure for staging and production deployment.

The system is intentionally serverless, low-ops, and biased toward pay-per-use AWS services.

## Repository Layout

- `apps/web`: React 19 + Vite single-page app
  - public homepage and supporting content pages
  - RSVP lookup, RSVP detail, and RSVP success flows
  - admin login callback handling and admin dashboard
- `apps/api`: Lambda-backed application logic
  - RSVP read and write flows
  - RSVP recovery flow
  - household CRUD and CSV import
  - invitation generation, reveal, export, labels, and email delivery
  - household notifications by email or SMS
- `packages/shared`: shared contracts
  - Zod schemas
  - API payload and response types
  - shared wedding site content types
  - calendar export helper
- `infra`: AWS CDK v2 stacks
  - certificates
  - main site stack
  - edge observability stack
- `.github/workflows`: CI and deploy automation

## Application Flows

### Public Site

The public frontend is a Vite SPA served through CloudFront. Current content includes wedding details, schedule, travel guidance, confirmed hotel blocks when configured, live registry links, story pages, legal pages, and contact information. The hotel-block area stays hidden until a publicly shareable hotel is available. SPA routing is preserved at the CDN layer so direct refreshes still resolve to `index.html`; post-mount hash handling keeps cross-page section links aligned below the sticky header.

The venue map uses an OpenStreetMap embed without third-party marker text and renders the venue marker in the application so its accessible label and presentation remain under the site's control.

Frontend image delivery is optimized through generated responsive assets under `apps/web/public/images` and shared asset manifests under `apps/web/src/generated`.

### Guest RSVP

Guests can:

- enter an invite code at `/rsvp`,
- open a direct household link at `/rsvp/{inviteCode}`,
- submit or revise their RSVP,
- and request recovery of their RSVP link through `/rsvp/recovery`.

The shared schemas cover household members, meal choices, plus-one handling, phone input, recovery contact input, standalone SMS preferences, and stored RSVP state. SMS preferences use the existing `household.smsConsent` property with `pending_confirmation`, `opted_in`, and `opted_out` states. Existing `opted_in` records remain valid.

SMS enrollment is independent from RSVP submission and recovery. A guest uses `/rsvp/{inviteCode}/sms-updates`; enabling stores `pending_confirmation`, sends the required Twilio confirmation, and moves to `opted_in` only after Twilio returns HTTP 2xx. Provider failure leaves the preference pending and retryable. Disabling immediately records `opted_out` without clearing the household phone. Only an `opted_in` record whose phone matches the household's current phone authorizes recovery or admin-authored application SMS. Email recovery and SES behavior are unchanged.

The intended security model is:

- high-entropy invite codes,
- generic failure messages for invalid lookups,
- invite-code hash lookup for household resolution,
- and optional KMS-encrypted ciphertext for admin-only recoverability.

Recovery links depend on `FRONTEND_BASE_URL`, so invitation and recovery features fail closed if a canonical frontend URL is not configured.

### Admin

Admins use Cognito Hosted UI sign-in at `/admin` with MFA required. When passkeys are enabled, the user pool is configured for WebAuthn plus MFA-required verification.

Current admin capabilities include:

- load auth configuration,
- create, update, archive, and browse households,
- update or remove household members,
- import households from CSV,
- rotate invite codes,
- reveal invitation details,
- mark invitation lifecycle status,
- export RSVP CSV,
- export invitation CSV,
- export invitation label PDFs,
- send single-household invitation emails,
- send bulk invitation emails,
- send direct household notifications by email or SMS.

The frontend includes a local admin mock path for isolated UI work, but deployed admin behavior is backed by Cognito and the API.

## Infrastructure

### Hosting and Delivery

The frontend stack uses:

- a private S3 bucket for site assets,
- CloudFront with Origin Access Control,
- HTTPS-only viewer policies,
- response headers policies for CSP and other security headers,
- and Route 53 alias records when custom domains are configured.

CloudFront behaviors distinguish the SPA shell, immutable built assets, generated images, and proxied `/api/*` requests.

### API and Compute

The backend uses:

- API Gateway HTTP API,
- a Node.js 24 Lambda handler,
- DynamoDB on-demand storage with point-in-time recovery,
- Secrets Manager for the invite-code pepper,
- and KMS for invite-code encryption when recoverability is enabled.

The API Lambda writes structured logs. API Gateway access logs are enabled explicitly. Log retention is managed in CDK rather than left to defaults.

### Auth

Admin authentication uses Amazon Cognito with:

- self-sign-up disabled,
- MFA required,
- email sign-in,
- strong password policy,
- Hosted UI branding,
- optional passkey support,
- and callback or logout URL construction based on the deployed frontend domain, CloudFront URL, and local-browser-trust setting.

### Notifications and Contact Flows

Email flows use Amazon SES for:

- admin invitation emails,
- RSVP notifications,
- optional inbound contact forwarding when the hosted zone and contact address are configured together.

SMS flows use Twilio through the API Lambda. Runtime configuration expects:

- `TWILIO_ACCOUNT_SID`,
- `TWILIO_API_KEY_SID`,
- `TWILIO_API_KEY_SECRET_ARN`,
- and either `TWILIO_MESSAGING_SERVICE_SID` or `TWILIO_FROM_PHONE_NUMBER`.

Twilio secret material belongs in AWS Secrets Manager, not in environment variables or committed files.

### Protection and Observability

The architecture uses layered abuse protection:

- CloudFront-attached WAF support for public RSVP traffic,
- API Gateway throttling on RSVP read, write, and recovery routes,
- least-privilege IAM grants,
- private S3 buckets,
- HTTPS-only delivery,
- and operational dashboards and alarms for API, Lambda, DynamoDB, CloudFront, optional WAF, and contact forwarding.

## Data and Security Model

The repo is built around these durable rules:

- Never commit plaintext secrets, guest data, or production invite codes.
- Do not store raw invite codes in DynamoDB or environment variables.
- Plaintext invite codes may appear only in authenticated admin responses, invitation CSV exports, and outgoing invitation emails or recovery messages.
- Do not log plaintext invite codes or full RSVP URLs.
- Keep admin routes behind Cognito authorization.
- Use generic guest-facing invite-code failures so household existence is not leaked.
- Keep infrastructure private by default and prefer least privilege.

Operationally, the API currently depends on a configured table name, invite-code pepper secret, and frontend base URL for invitation or recovery link generation.

## API Surface

Current API routes implemented by `apps/api/src/handler.ts`:

### Public routes

- `GET /api/rsvp/{inviteCode}`
- `PUT /api/rsvp/{inviteCode}`
- `PUT /api/rsvp/{inviteCode}/sms-preferences`
- `POST /api/rsvp/recovery`

### Admin routes

- `GET /api/admin/auth/config`
- `GET /api/admin/households`
- `POST /api/admin/households`
- `POST /api/admin/households/import`
- `PUT /api/admin/households/{householdId}`
- `DELETE /api/admin/households/{householdId}`
- `PUT /api/admin/households/{householdId}/members/{memberId}`
- `DELETE /api/admin/households/{householdId}/members/{memberId}`
- `PUT /api/admin/households/{householdId}/invite-lifecycle`
- `POST /api/admin/households/{householdId}/invite-code`
- `GET /api/admin/households/{householdId}/invitation`
- `POST /api/admin/households/{householdId}/invitation-email`
- `POST /api/admin/households/{householdId}/notifications`
- `POST /api/admin/invitations/email`
- `GET /api/admin/invitations/export`
- `GET /api/admin/invitations/labels`
- `GET /api/admin/rsvps/export`

## Deployment and Release Model

The repository assumes `main` is the only long-lived branch.

- CI runs on pushes to `main` and pull requests targeting `main`.
- Staging deploys run on pushes to `main`.
- Production deploys run when a non-prerelease GitHub Release is published for a `v*` tag.
- Manual deploy workflow dispatch remains available for staging or production.
- Production deploys verify that the requested ref already resolves to a commit on `main`.

GitHub environments provide deploy-time configuration and the OIDC role ARN. Deployment config resolution order is:

1. CDK context values
2. shell or CI environment variables
3. local `.env`, `.env.local`, `.env.<environment>`, and `.env.<environment>.local`

The committed defaults in `infra/config/deployment-config.ts` intentionally avoid placeholder domains and other risky committed values.

## Testing and Quality Gates

Repository scripts cover:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run synth`
- `npm run test:e2e`

CI and deploy verification currently run:

- `npm ci`
- lint
- typecheck
- `npm run test:ci`
- `npm run build`
- Playwright Chromium end-to-end coverage

The repo expectation is:

- unit and integration coverage for shared validation, invite-code handling, backend logic, and admin behavior,
- end-to-end checks for public pages, RSVP flows, admin flows, exports, and SPA routing,
- and documentation updates whenever repo behavior, constraints, or operating procedures change.

## Operating Assumptions

- App-region defaults stay in `us-west-1`.
- CloudFront certificate support still requires `us-east-1`.
- The site is low traffic and should stay cheap to operate.
- AWS serverless primitives are the default choice unless a real need proves otherwise.
- Staging remains the proving ground for domain, Cognito, SES, Twilio, WAF, and launch rehearsals before production changes are trusted.
