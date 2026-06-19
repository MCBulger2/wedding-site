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

The frontend uses `/api` as its default API base path for local development. Staging and production deployment builds inject the configured API custom domain automatically, so live bundles call the environment-specific API URL directly. For local API experiments, you can still set `VITE_API_BASE_URL` to a deployed API Gateway URL or a local Lambda adapter.

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

The default staging and production settings live in [infra/config/deployment-config.ts](infra/config/deployment-config.ts):

- `staging`: `staging.example.com`, `api.staging.example.com`, `login.staging.example.com`
- `production`: `www.example.com`, `api.example.com`, `login.example.com`
- notifications: sender defaults to `staging-rsvp@example.com` in staging and `rsvp@example.com` in production; recipient defaults to `admin@example.com`
- passkeys: enabled in both environments

These tracked defaults are placeholders. Set your real domains and notification targets through CDK context or environment variables before deploying.

You can still override any value with CDK context or environment variables. For example:

```bash
npm run deploy:infra -- WeddingSite-staging -c envName=staging -c frontendDomainName=example.com -c hostedZoneDomain=example.com
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
- Variable `ENABLE_PASSKEYS`: optional `true` or `false` override.

## Security And Cost Principles

- Keep all infrastructure private by default.
- Do not expose S3 buckets publicly.
- Require HTTPS everywhere.
- Use high-entropy RSVP invite codes and store only hashed invite codes.
- Protect admin routes with Cognito and MFA.
- Use least-privilege IAM policies.
- Avoid long-lived AWS credentials in GitHub.
- Prefer serverless and on-demand services to avoid idle cost.
- Avoid always-on compute, NAT gateways, or relational databases unless a clear need emerges.
- Run relevant unit and end-to-end tests before considering implementation work complete.
