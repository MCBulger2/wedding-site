# Launch Readiness

Use this document as the pre-launch checklist and staging rehearsal guide. Architecture details live in [ARCHITECTURE.md](ARCHITECTURE.md).

## Release Gate

Before invitations are printed or production traffic is announced, verify all of the following against real AWS and GitHub state:

- staging deploys cleanly from `main`
- production deploy wiring still matches the intended `v*` release flow
- staging and production GitHub environment variables are correct
- custom domains, Cognito auth domain, SES, Twilio, and WAF settings match the live plan
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
- `TWILIO_ACCOUNT_SID`
- `TWILIO_API_KEY_SID`
- `TWILIO_API_KEY_SECRET_ARN`
- `TWILIO_MESSAGING_SERVICE_SID` or `TWILIO_FROM_PHONE_NUMBER`
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

## Twilio SMS Checks

Confirm production SMS wiring uses:

- account SID
- API key SID
- API key secret stored in Secrets Manager
- either a Messaging Service SID or a from-number

Twilio reviewer-visible consent checklist:

- use the exact public URL `https://matt-alison.com/sms-updates`; it must load without an invite code or authentication
- show the `Matt & Alison Wedding` brand, sole proprietor `Matthew Bulger`, and `contact@matt-alison.com`
- start with an empty phone field and an unchecked consent checkbox
- require affirmative consent before `Sign up for text updates` submits
- state the message purpose and variable frequency, that message and data rates may apply, and that consent is optional and independent from RSVP submission
- include working Terms and Privacy Policy links, the HELP/STOP disclosure, and the promise that text-message opt-in data and consent are not shared with third parties

Before an authorized production deployment:

- confirm consent copy and opt-out expectations are acceptable
- confirm partial or broken Twilio config fails SMS delivery without breaking email delivery or RSVP writes
- confirm the public route has API Gateway throttling of 1 request per second with a burst of 3, plus service limits of 3 attempts per normalized phone and 10 attempts per source IP per hour

After an authorized production deployment, pass this controlled-handset gate before sharing the consent URL with Twilio or enabling guest messaging:

- the exact public URL `https://matt-alison.com/sms-updates` loads and submits without authentication
- a signup from one controlled handset receives one real branded `Matt & Alison Wedding` confirmation containing HELP and STOP instructions
- DynamoDB contains one standalone `SmsSubscription` record that transitions from `pending_confirmation` to `opted_in` only after Twilio accepts delivery
- repeating enrollment for the same normalized phone updates that record and does not create a duplicate
- Lambda and API Gateway logs contain no raw phone number or source IP

Do not send the public URL to Twilio for review until every item in the controlled-handset gate passes.

## Abuse Protection and Security Checks

Verify the live production environment has:

- CloudFront WAF association for public RSVP traffic
- API Gateway throttling on RSVP read, write, and recovery routes
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
- verify RSVP recovery by stored email and stored phone flows
- verify phone recovery sends only for a matching current phone with active `opted_in` consent; recovery must never enroll or reactivate SMS
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
- confirm the Twilio toll-free sender is in the intended Messaging Service sender pool and the canonical `/sms-updates`, Terms, and Privacy pages match the submitted consent flow
- confirm the toll-free verification identifies sole proprietor `Matthew Bulger`, brand `Matt & Alison Wedding`, and `contact@matt-alison.com`
- use the non-promotional, invited-guest estimate of approximately 100 messages for the verification submission; complete an internal pre-review before submitting
- after the controlled-handset gate and Twilio approval, test live HELP, STOP, and START behavior end to end before enabling guest messaging
- verify standalone SMS preferences transition pending to active only after a Twilio HTTP 2xx, failed confirmation remains retryable, and website opt-out blocks recovery and admin-authored SMS
- rerun the highest-risk production smoke checks after deploy
