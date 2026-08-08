# Launch Readiness

Use this document as the pre-launch checklist and staging rehearsal guide. Architecture details live in [ARCHITECTURE.md](ARCHITECTURE.md).

## Release Gate

Before invitations are printed or production traffic is announced, verify all of the following against real AWS and GitHub state:

- staging deploys cleanly from `main`
- production deploy wiring still matches the intended `v*` release flow
- staging and production GitHub environment variables are correct
- custom domains, Cognito auth domain, SES, and WAF settings match the live plan; dormant Twilio settings are documented separately
- admin login, RSVP, export, and recovery flows still behave as expected

Completing this checklist does not authorize a production deployment. Creating or publishing the production release requires separate, explicit authorization from the site owner.

## Configuration Checks

Confirm deployment config is split correctly:

- committed defaults stay in `infra/config/deployment-config.ts`
- local overrides stay in ignored `.env*.local` files
- GitHub Actions deploys use GitHub environment variables and secrets

Important deploy-time inputs to verify before launch:

- `AWS_DEPLOY_ROLE_ARN`
- `AWS_REGION`
- `HOSTED_ZONE_DOMAIN`
- `FRONTEND_DOMAIN_NAME`
- `API_DOMAIN_NAME`
- `AUTH_DOMAIN_NAME`
- `ALLOWED_ORIGINS`
- `ENABLE_LOCAL_BROWSER_TRUST`
- `NOTIFICATION_SENDER_EMAIL`
- `NOTIFICATION_RECIPIENT_EMAILS`
- `OPERATIONS_ALERT_EMAILS`
- `CONTACT_EMAIL_ADDRESS`
- `CONTACT_FORWARDING_RECIPIENT_EMAIL`
- `ENABLE_PASSKEYS`

Expected branch and deployment model:

- `main` is the only long-lived branch
- push to `main` deploys staging
- published non-prerelease `v*` release deploys production
- production refs must already be on `main`

## Domain and Browser Trust Checks

Validate the full environment domain set together:

- frontend domain
- API domain
- Cognito auth domain
- hosted zone
- allowed browser origins

Before launch:

- confirm staging and production alias records resolve correctly
- confirm CloudFront serves the site over HTTPS
- confirm `/api/admin/auth/config` resolves on the intended API domain
- confirm Cognito callback and logout URLs match the real frontend URLs
- confirm local browser trust is enabled only where explicitly intended

## SES and Contact Email Checks

Verify outbound email and optional inbound forwarding:

- SES sender identity exists and is healthy
- DKIM and related DNS records are correct
- notification recipients are intentional
- sandbox restrictions are removed or all required recipients are verified
- `contact@matt-alison.com` forwarding is enabled only in the environment meant to own it
- the forwarding recipient is configured outside source control
- forwarded messages preserve a useful `Reply-To`

Guest RSVP writes should continue even if notification delivery fails. Validate that failure mode before launch.

## RSVP Search and Recovery Checks

Before launch, verify the visible guest flows:

- an exact invited-member last-name match through `POST /api/rsvp/search` lets the guest select a result and opens its private RSVP URL
- search results disclose only `displayName` and `rsvpUrl`
- no-match searches show the no-match state
- searches with more than 10 matches return the too-many state and do not show partial results
- the search limits are enforced at 5 attempts per term per hour and 20 attempts per source IP per hour, with API Gateway throttling also active
- email recovery sends or accepts the request without revealing whether a guest exists, and the resulting link is recovered through KMS-protected invite-code ciphertext
- admin household notifications are email-only in the visible website
- no visible public or admin page exposes SMS enrollment, preferences, recovery, or notifications
- legacy `/sms-updates`, `/sms-opt-in-proof`, and `/rsvp/{inviteCode}/sms-updates` URLs redirect without rendering SMS UI

## Optional SMS/Twilio Re-enable Checklist

SMS remains dormant and must not be enabled as part of the current launch. If it is deliberately re-enabled later:

- configure the documented Twilio identifiers and keep the API secret in Secrets Manager
- restore only an explicitly reviewed website flow and verify the legacy redirects are intentionally replaced
- obtain renewed legal, consent, messaging-purpose, HELP/STOP, opt-out, privacy, and regulatory review
- verify rate limits, API Gateway throttling, delivery failure handling, and logging do not expose phone numbers or source IPs
- test controlled-handset enrollment, confirmation, duplicate handling, opt-out, and admin-authored SMS in staging before production
- confirm SMS re-enablement does not change email delivery or RSVP write behavior

## Abuse Protection and Security Checks

Verify the live production environment has:

- CloudFront WAF association for public RSVP traffic
- API Gateway throttling on RSVP read, write, search, and recovery routes
- private S3 buckets
- HTTPS-only delivery
- Cognito MFA and intended passkey behavior
- DynamoDB point-in-time recovery
- Secrets Manager storage for secret material
- no raw invite codes in DynamoDB attributes, Lambda environment variables, or logs

## Staging Rehearsal

Run a full staging rehearsal before printing invitations:

- deploy staging with the intended domain suite and notification settings
- create test households
- generate, reveal, export, and email invitation links
- verify exported or sent households do not accidentally rotate to new mailed URLs without explicit confirmation
- submit and update RSVPs from invite links
- verify exact last-name search, result selection, no-match, and too-many-match states
- verify RSVP recovery by email only, including generic responses and KMS-backed link recovery
- verify no public or admin page exposes SMS controls and legacy SMS URLs redirect
- confirm recovery messages contain the private RSVP link and do not expose extra plaintext invite-code fields
- verify admin login, household editing, archive behavior, CSV export, and label export
- verify public pages, RSVP routes, admin routes, and SPA refresh behavior

## Final Launch Review

Immediately before production launch:

- compare GitHub environment values with the intended live configuration
- confirm the production release tag resolves to the tested commit on `main`
- review alarms, dashboards, and log groups
- confirm operations alert recipients have accepted SNS subscriptions
- confirm contact, notification, and recovery destinations are correct
- if SMS was separately re-enabled, complete its optional Twilio and compliance checklist before enabling guest messaging
- rerun the highest-risk production smoke checks after deploy
