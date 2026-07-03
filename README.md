# Matt and Alison Wedding Website

[![develop](https://github.com/MCBulger2/wedding-site/actions/workflows/deploy.yml/badge.svg?branch=develop)](https://github.com/MCBulger2/wedding-site/actions/workflows/deploy.yml)
[![main](https://github.com/MCBulger2/wedding-site/actions/workflows/deploy.yml/badge.svg?branch=main)](https://github.com/MCBulger2/wedding-site/actions/workflows/deploy.yml)

This repository will contain the wedding announcement and RSVP website for Matt and Alison's 2027 wedding.

The site is intended to be simple, secure, cost effective, and easy to maintain. It will provide a public homepage with wedding details and photos, plus a private RSVP flow where invited households can create, view, and edit their RSVP after receiving a mailed invite.

## Architecture

The preferred application architecture is:

- React + Vite single-page frontend.
- AWS serverless backend for RSVP and admin workflows.
- Route 53 for domain registration and DNS.
- CloudFront in front of a private S3 bucket for frontend hosting.
- API Gateway HTTP API for backend endpoints.
- Lambda for API handlers.
- DynamoDB on-demand for guest, invite, and RSVP data.
- Cognito for admin authentication.
- AWS CDK v2 in TypeScript for infrastructure as code.
- GitHub Actions for CI/CD using AWS OIDC, not long-lived AWS access keys.

The detailed implementation plan lives in [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md).

## Local Development

This repository is a TypeScript monorepo:

- `apps/web`: React + Vite single-page app.
- `apps/api`: Lambda handler, invite-code authorization, RSVP validation, CSV helpers, and backend business logic.
- `packages/shared`: shared validation schemas and API types.
- `infra`: AWS CDK v2 app for the serverless website infrastructure.

Install dependencies and run the usual checks from the repository root:

```bash
npm install
npm run lint
npm run typecheck
npm run test
npm run build
npm run synth
npm run test:e2e
```

Start the local web app with:

```bash
npm run dev
```

The frontend uses `/api` as its default API base path for local development. Staging and production deployment builds load environment-specific config before building the Vite bundle. If `API_DOMAIN_NAME` is configured, the bundle uses `https://API_DOMAIN_NAME/api`; otherwise it keeps `/api` and relies on the CloudFront `/api/*` proxy. For local API experiments, you can still set `VITE_API_BASE_URL` to a deployed API Gateway URL or a local Lambda adapter.

Admin authentication uses the Cognito Hosted UI. The stack now configures `/admin` as an OAuth callback URL for:

- `http://localhost:5173/admin`
- `http://127.0.0.1:5173/admin`
- the deployed CloudFront domain
- the configured custom domain, when present

To use admin login after deployment:

1. Create an admin user in the Cognito user pool output by the stack.
2. Visit `/admin` on the site.
3. Sign in through the Cognito Hosted UI and complete MFA.

Deploy infrastructure from the repository root after AWS credentials are configured and the target account is CDK-bootstrapped in both the app region and `us-east-1` for CloudFront certificates:

```bash
npm run bootstrap:infra -- aws://ACCOUNT_ID/us-west-1 aws://ACCOUNT_ID/us-east-1
```

You only need to bootstrap an account/region once. The deploy workflow also checks this prerequisite before running `cdk deploy`.

```bash
npm run deploy:infra:staging
npm run deploy:infra:production
```

Deployment config can come from three places, in this order:

- CDK context values passed with `-c`.
- Shell or GitHub Actions environment variables.
- Local env files loaded from `.env`, `.env.local`, `.env.<environment>`, and `.env.<environment>.local`.

The committed fallback settings in [infra/config/deployment-config.ts](infra/config/deployment-config.ts) are intentionally safe: no placeholder custom domains, no placeholder notification recipients, and passkeys enabled. That means a local deploy can fall back to the generated CloudFront and API Gateway domains instead of failing on example Route 53 lookups.

For local staging or production deploys with custom domains and notifications, copy the matching template and fill in local values:

```bash
cp .env.staging.example .env.staging.local
cp .env.production.example .env.production.local
```

Local `.env*` files are ignored by Git. Do not commit real domains, notification recipients, Twilio API key secrets, guest data, or invite codes. SMS delivery uses Twilio through the API Lambda. Store the Twilio API key secret value in AWS Secrets Manager and configure only the account/API key identifiers, sender identifier, and secret ARN in environment variables.

You can still override any value with CDK context or environment variables. For example:

```bash
npm run deploy:infra -- WeddingSiteCertificates-staging WeddingSite-staging -c envName=staging -c frontendDomainName=example.com -c hostedZoneDomain=example.com
```

Destroy infrastructure with the matching commands when you intentionally want to tear an environment down:

```bash
npm run destroy:infra:staging
npm run destroy:infra:production
```

Production resources use retain policies where appropriate, so a production destroy may leave retained data-bearing resources for manual review.

## Deployment Overview

Production should be deployed through GitHub Actions after required checks pass. The deployment should synthesize and deploy CDK stacks for:

- Route 53 DNS records.
- ACM certificates for HTTPS.
- Private S3 frontend asset bucket.
- CloudFront distribution with secure headers and SPA routing.
- API Gateway HTTP API.
- Lambda API handlers.
- DynamoDB tables with point-in-time recovery.
- Cognito user pool for admin access.
- WAF rules and rate limits where appropriate.
- CloudWatch log groups with explicit retention.

Use separate staging and production environments so risky changes can be tested before guests use the site.

The deploy workflow expects these GitHub environment settings:

- Secret `AWS_DEPLOY_ROLE_ARN`: IAM role assumable by GitHub Actions through OIDC.
- Variable `AWS_REGION`: app region override, defaulting to the environment config value `us-west-1`.
- Variable `FRONTEND_DOMAIN_NAME`: optional frontend domain override.
- Variable `API_DOMAIN_NAME`: optional API domain override.
- Variable `AUTH_DOMAIN_NAME`: optional Cognito custom domain override.
- Variable `HOSTED_ZONE_DOMAIN`: optional hosted-zone lookup domain override.
- Variable `ALLOWED_ORIGINS`: optional comma-separated CORS origins for direct API access.
- Variable `NOTIFICATION_SENDER_EMAIL`: optional SES sender override.
- Variable `NOTIFICATION_RECIPIENT_EMAILS`: optional comma-separated notification recipients.
- Variable `TWILIO_ACCOUNT_SID`: optional Twilio account SID for SMS delivery.
- Variable `TWILIO_API_KEY_SID`: optional Twilio API key SID for SMS delivery.
- Variable `TWILIO_API_KEY_SECRET_ARN`: optional AWS Secrets Manager ARN containing the Twilio API key secret.
- Variable `TWILIO_MESSAGING_SERVICE_SID`: optional Twilio Messaging Service SID for SMS sender configuration.
- Variable `TWILIO_FROM_PHONE_NUMBER`: optional Twilio sender phone number. Set this instead of `TWILIO_MESSAGING_SERVICE_SID` when not using a Messaging Service.
- Variable `CONTACT_EMAIL_ADDRESS`: optional public contact email address, for example `contact@matt-alison.com`.
- Variable `CONTACT_FORWARDING_RECIPIENT_EMAIL`: optional private forwarding recipient for inbound contact emails. Set this in GitHub environment variables or local env files; do not commit personal recipient addresses.
- Variable `ENABLE_PASSKEYS`: optional `true` or `false` override.

When `CONTACT_EMAIL_ADDRESS`, `CONTACT_FORWARDING_RECIPIENT_EMAIL`, and `HOSTED_ZONE_DOMAIN` are all configured and the contact address domain matches the hosted zone, CDK enables SES inbound email for the domain, creates an MX record for SES receiving, stores raw inbound mail in a private expiring S3 bucket, and forwards messages to the configured recipient from the public contact address. The forwarding email sets `Reply-To` to the original sender when it can be parsed safely, so replies from the recipient mailbox go back to the guest. If SES is still in sandbox, the forwarding recipient must be verified or SES production sending must be enabled before live forwarding works.

## Security And Cost Principles

- Keep all infrastructure private by default.
- Do not expose S3 buckets publicly.
- Require HTTPS everywhere.
- Use high-entropy RSVP invite codes. Store hashes for guest lookup and only KMS-encrypted ciphertext for admin recoverability.
- Protect admin routes with Cognito and MFA.
- Use least-privilege IAM policies.
- Avoid long-lived AWS credentials in GitHub.
- Prefer serverless and on-demand services to avoid idle cost.
- Avoid always-on compute, NAT gateways, or relational databases unless a clear need emerges.
- Run relevant unit and end-to-end tests before considering implementation work complete.
