# Launch Readiness Notes

This project now has code support for the remaining launch phases. The items below still require real AWS account, DNS, SES, and staging data verification before invitations are printed.

## Deployment Configuration

Deployment settings are intentionally split between committed safe defaults and untracked or CI-provided environment values.

- `infra/config/deployment-config.ts` keeps deployable fallback values only: app region, localhost CORS origins, no custom domains, no notification recipients, and passkeys enabled.
- Local deploys load `.env`, `.env.local`, `.env.<environment>`, and `.env.<environment>.local` before build and CDK synth.
- GitHub Actions deploys use GitHub environment variables and secrets instead of committed `.env` files.

GitHub releases use `main` as the only long-lived branch:

- Feature pull requests target `main`.
- Merges to `main` automatically deploy the current commit to staging.
- Production deploys start automatically when a non-prerelease GitHub Release is published for a `v*` tag whose commit is already on `main`.
- The production workflow verifies the tagged commit is on `main`, then waits on the production GitHub environment before deploying production. It does not redeploy staging, so production can intentionally remain behind the latest staging commit.
- `develop` and release branches are not deployment sources.

For local custom-domain deploys, copy the relevant template:

```bash
cp .env.staging.example .env.staging.local
cp .env.production.example .env.production.local
```

The local files should contain the real domain, hosted zone, API domain, auth domain, CORS origins, SES sender, notification recipients, Twilio SMS identifiers, and passkey setting. They are ignored by Git and must stay out of source control. Store the Twilio API key secret value in AWS Secrets Manager and put only its secret ARN in local or CI configuration.

Use CDK context values only when you need to override those defaults:

```bash
npm run deploy:infra:staging -- \
  -c hostedZoneDomain=matt-alison.com \
  -c frontendDomainName=staging.matt-alison.com \
  -c apiDomainName=api.staging.matt-alison.com \
  -c authDomainName=login.staging.matt-alison.com \
  -c allowedOrigins=https://staging.matt-alison.com \
  -c notificationSenderEmail=staging-rsvp@matt-alison.com \
  -c notificationRecipientEmails=admin@example.com

npm run deploy:infra:production -- \
  -c hostedZoneDomain=example.com \
  -c frontendDomainName=www.example.com \
  -c apiDomainName=api.example.com \
  -c authDomainName=auth.example.com \
  -c allowedOrigins=https://www.example.com \
  -c notificationSenderEmail=wedding@example.com \
  -c notificationRecipientEmails=admin1@example.com,admin2@example.com \
  -c twilioAccountSid=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  -c twilioApiKeySid=SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  -c twilioApiKeySecretArn=arn:aws:secretsmanager:us-west-1:123456789012:secret:twilio-api-key-AbCdEf \
  -c twilioMessagingServiceSid=MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  -c contactEmailAddress=contact@matt-alison.com \
  -c contactForwardingRecipientEmail=admin@example.com
```

`domainName` is still accepted as a shorthand for the frontend domain, but `frontendDomainName` is clearer for production.

## SES Verification

RSVP notifications and invitation emails use SES through the API Lambda. If the notification sender email is under the hosted zone domain, CDK creates an SES domain identity and DKIM DNS records. Recipient verification and SES sandbox removal still need to be completed in AWS before production launch.

Notifications are best-effort. Guest RSVP saves continue even if SES delivery fails, and failures are logged with household ID and RSVP update time.

The public contact address is `contact@matt-alison.com`. When the production deploy provides `CONTACT_EMAIL_ADDRESS=contact@matt-alison.com`, `CONTACT_FORWARDING_RECIPIENT_EMAIL`, and `HOSTED_ZONE_DOMAIN=matt-alison.com`, CDK also configures SES receiving for the hosted zone, creates the SES MX record, stores raw inbound messages in a private S3 bucket with 30-day expiration, and forwards messages to the configured recipient. Do not commit the real forwarding recipient to source control. Replying from the recipient mailbox should go to the original sender through the forwarded email's `Reply-To` header; Gmail alias or SMTP send-as setup can be handled manually later if true replies from `contact@matt-alison.com` become required.

Leave `CONTACT_EMAIL_ADDRESS` and `CONTACT_FORWARDING_RECIPIENT_EMAIL` unset in staging unless inbound contact forwarding is being tested deliberately. Staging can still display the public contact address through the shared site-content default without creating an SES receipt rule set for the apex domain.

## Twilio SMS Verification

Household SMS notifications and RSVP recovery SMS messages use Twilio's REST Messages API through the API Lambda. Production auth should use a Twilio API key SID plus API key secret. The secret value must live in AWS Secrets Manager; Lambda environment variables should contain only `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET_ARN`, and either `TWILIO_MESSAGING_SERVICE_SID` or `TWILIO_FROM_PHONE_NUMBER`.

Before launch, verify the Twilio sender or Messaging Service can send to the expected guest phone numbers, that opt-out/compliance settings are acceptable for event notifications, and that incomplete Twilio configuration fails SMS sends without affecting SES email delivery.

## Public RSVP Abuse Protection

Production CDK synth and deploy now attach a CloudFront-scoped WAF web ACL to the site distribution for `/api/rsvp*` traffic. The ACL applies the AWS managed Amazon IP reputation list, the AWS managed common protections, and a per-IP rate-based block rule for repeated RSVP requests. The public HTTP API stage also applies explicit throttling on the RSVP read, RSVP write, and recovery routes so the direct execute-api endpoint still has infrastructure-level backpressure even outside the CloudFront path.

Before launch, confirm the production deploy includes the CloudFront web ACL association, that WAF sampled requests and CloudWatch metrics are visible, and that the rate limits still leave enough headroom for normal RSVP edits and invitation-recovery retries.

## Cognito Passkeys

Amazon Cognito currently documents WebAuthn/passkey support for user pools, and passkeys with user verification can satisfy MFA requirements in the supported configuration. CDK also exposes passkey sign-in properties in the installed version.

Passkeys are enabled by default for both staging and production. Keep the MFA-required sign-in rehearsal in the launch checklist because the live Cognito hosted UI, custom auth domain, relying-party ID, callback URL, and MFA behavior still need to be verified together in staging before launch.

References:

- https://docs.aws.amazon.com/cognito/latest/developerguide/authentication.html
- https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-mfa.html

## Staging Rehearsal

Before printing invitations:

- Deploy staging with the intended domain, auth domain, SES notification settings, and Twilio SMS settings.
- Create test households, generate/reveal/export invitation URLs and QR codes, and verify old URLs are not rotated after export or sent status.
- Verify invitation email send and re-send reuse the same RSVP URL.
- Submit and update RSVP responses from invite links.
- Verify RSVP notification emails arrive and do not contain invite codes or hashes.
- Verify lost-code recovery email and SMS messages only include the private RSVP link, are sent only to stored household contacts, and do not include a separate plaintext invite-code field.
- Confirm invite codes are stored only as hashes and KMS-encrypted ciphertext, not raw plaintext DynamoDB attributes or logs.
- Verify admin dashboard login, household editing, archive behavior, invitation CSV export, RSVP CSV export, and SPA routing.
- Confirm S3 bucket privacy, HTTPS redirects, API CORS origins, Cognito callback/logout URLs, DynamoDB PITR, KMS key access, CloudWatch retention, and Secrets Manager invite-code pepper.
