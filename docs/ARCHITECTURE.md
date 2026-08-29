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
  - household notifications by email, with dormant SMS backend support
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

The public frontend is a Vite SPA served through CloudFront. Current content includes wedding details, schedule, travel guidance, a hotel-block area with a friendly TBD message until a publicly shareable hotel is available, live registry links, a static story route with responsive personal photography and device-aware Google/Apple map links for Phoenix recommendations, legal pages, and contact information. SPA routing is preserved at the CDN layer so direct refreshes still resolve to `index.html`; post-mount hash handling keeps cross-page section links aligned below the sticky header.

The venue map uses an OpenStreetMap embed with its native venue marker, so the marker stays synchronized while guests pan or zoom; the application retains the descriptive frame title and outbound map link.

Frontend image delivery is optimized through generated responsive assets under `apps/web/public/images` and shared asset manifests under `apps/web/src/generated`.

### Guest RSVP

Guests can:

- enter an invite code at `/rsvp`,
- search for a household by the exact last name printed on the invitation,
- open a direct household link at `/rsvp/{inviteCode}`,
- submit or revise their RSVP,
- and request recovery of their RSVP link by email through `/rsvp/recovery`.

The public `POST /api/rsvp/search` route trims and lowercases the submitted term, then performs an exact normalized match against active invited-member last names. Each successful result returns the household `displayName` and `rsvpUrl`. No separate `inviteCode` field is returned, but `rsvpUrl` embeds the bearer credential that grants access to the household RSVP and must be treated as private. Search returns at most 10 results. If more than 10 recoverable households match, it returns an empty result list with `tooManyMatches: true` instead of partially disclosing the matches. The route is limited to 5 attempts per normalized search term per hour and 20 attempts per source IP per hour, in addition to API Gateway throttling of 2 requests per second with a burst of 5. Application-level `429` responses include `Retry-After` for the remaining fixed-window duration. The route obtains each RSVP URL through the existing recoverable-invite-code path, which decrypts the stored invite-code ciphertext with the KMS-backed protector and verifies the resulting code before constructing the URL.

The current website recovery experience is email-only: the RSVP page exposes an email address field and sends `POST /api/rsvp/recovery`. It does not expose phone or SMS recovery controls. The backend retains a generic accepted response and the existing KMS-backed link recovery so that guest existence is not disclosed.

The shared schemas cover household members, meal choices, plus-one handling, phone input, recovery contact input, standalone SMS preferences, and stored RSVP state. SMS preferences use the existing `household.smsConsent` property with `pending_confirmation`, `opted_in`, and `opted_out` states. Existing `opted_in` records remain valid.

### Dormant SMS/Twilio backend

SMS support is preserved as dormant backend capability and is separate from the current visible website behavior. The service still contains the RSVP SMS-preference flow, public `POST /api/sms-subscriptions` enrollment, phone-based recovery handling, and admin-authored SMS notification delivery through Twilio when explicitly configured. These paths are not linked from the current public or admin website: there is no visible SMS enrollment, preference, recovery, or admin notification control. Legacy `/sms-updates`, `/sms-opt-in-proof`, and `/rsvp/{inviteCode}/sms-updates` website paths redirect to the current home or RSVP route rather than rendering SMS UI.

The preserved Twilio integration expects `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET_ARN`, and either `TWILIO_MESSAGING_SERVICE_SID` or `TWILIO_FROM_PHONE_NUMBER`. Twilio secret material remains in AWS Secrets Manager. Re-enabling this capability would require a deliberate UI/configuration change and renewed consent, messaging, opt-out, and regulatory review; these settings are not part of the current visible RSVP launch flow.

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
- export QR, mailing-address, and return-address Avery 5160 label PDFs,
- send single-household invitation emails,
- send bulk invitation emails,
- send direct household notifications by email.

The current admin notification UI is email-only and does not expose an SMS notification control; the backend SMS notification path is preserved as dormant support.

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

The preserved SMS/Twilio backend and its configuration are described in [Dormant SMS/Twilio backend](#dormant-smstwilio-backend). They are not current website controls or a current visible notification channel.

### Protection and Observability

The architecture uses layered abuse protection:

- CloudFront-attached WAF support for public RSVP traffic,
- API Gateway throttling on RSVP read, write, search, and recovery routes,
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
- `POST /api/rsvp/search`
- `POST /api/rsvp/recovery`

### Dormant SMS backend routes

These routes remain implemented for possible future re-enablement but are not linked by the current website:

- `PUT /api/rsvp/{inviteCode}/sms-preferences`
- `POST /api/sms-subscriptions`

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
- `POST /api/admin/households/{householdId}/notifications` (current website uses email; dormant backend also retains SMS support)
- `POST /api/admin/invitations/email`
- `GET /api/admin/invitations/export`
- `GET /api/admin/invitations/labels`
- `GET /api/admin/addresses/labels`
- `GET /api/admin/return-addresses/labels`
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
- responsive-image cache restoration followed by one explicit responsive-image preparation step
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
- Staging remains the proving ground for domain, Cognito, SES, WAF, and launch rehearsals before production changes are trusted. Any future SMS/Twilio re-enable requires a separate configuration and compliance rehearsal.
