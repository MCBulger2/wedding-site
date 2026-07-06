# Matt and Alison Wedding Website

[![CI](https://github.com/MCBulger2/wedding-site/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/MCBulger2/wedding-site/actions/workflows/ci.yml)
[![Deploy](https://github.com/MCBulger2/wedding-site/actions/workflows/deploy.yml/badge.svg?branch=main)](https://github.com/MCBulger2/wedding-site/actions/workflows/deploy.yml)

Wedding announcement, RSVP, and invitation-management site for Matt and Alison's January 2027 wedding.

## Status

This repository is an active implementation, not a scaffold:

- Public site content, travel details, registry links, photo sections, and legal pages live in the React app.
- Guests RSVP through private household invite links and can request link recovery through stored household contact details.
- Admins sign in through Cognito, manage households, generate or reveal invitation links, send invitation emails, send household notifications, and export RSVP or invitation data.
- AWS infrastructure, CI, and staged deployment workflows are committed in this repo.

## Architecture Snapshot

- `apps/web`: React 19 + Vite single-page app for public pages, RSVP, and admin UI.
- `apps/api`: Lambda-backed API for RSVP, admin operations, notifications, invitation exports, and recovery flows.
- `packages/shared`: shared Zod schemas, API contracts, calendar helpers, and site-content types.
- `infra`: AWS CDK v2 stacks for CloudFront, private S3 hosting, API Gateway, Lambda, DynamoDB, Cognito, Route 53, ACM, SES, WAF, and observability.
- Delivery model: CI on pushes and PRs to `main`; staging deploys from `main`; production deploys from a non-prerelease `v*` GitHub Release or manual production dispatch, and the production ref must already be on `main`.

## Quick Start

```bash
npm install
npm run lint
npm run typecheck
npm run test
npm run build
```

Start the frontend locally:

```bash
npm run dev
```

Useful follow-up commands:

```bash
npm run synth
npm run test:e2e
npm run deploy:infra:staging
```

## Common Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite frontend |
| `npm run lint` | Run ESLint across the monorepo |
| `npm run typecheck` | Run TypeScript project builds |
| `npm run test` | Run Vitest unit and integration tests |
| `npm run build` | Build shared package, API, frontend, and CDK app |
| `npm run synth` | Synthesize CDK stacks |
| `npm run test:e2e` | Run Playwright end-to-end tests |
| `npm run deploy:infra:staging` | Build for staging and deploy staging stacks |
| `npm run deploy:infra:production` | Build for production and deploy production stacks |
| `npm run destroy:infra:staging` | Intentionally tear down staging |
| `npm run destroy:infra:production` | Intentionally tear down production |

## Local Configuration

Deployment config comes from CDK context, environment variables, and optional local env files. The committed defaults in [infra/config/deployment-config.ts](infra/config/deployment-config.ts) stay intentionally safe: no committed custom domains, no committed notification recipients, no extra trusted origins, passkeys enabled, staging local browser trust enabled, and production local browser trust disabled.

For local custom-domain deploys, start from the example files:

```bash
cp .env.staging.example .env.staging.local
cp .env.production.example .env.production.local
```

Keep real domains, recipient addresses, Twilio identifiers, Secrets Manager ARNs, guest data, and invite codes out of source control.

## Deployment Summary

- `main` is the only long-lived branch.
- CI runs on pushes and pull requests targeting `main`.
- A push to `main` triggers staging deployment.
- Production deploys come from a published non-prerelease `v*` GitHub Release or a manual production dispatch.
- Production deploys are refused unless the target ref already resolves to a commit on `main`.

GitHub Actions use Node 24, `npm ci`, linting, typechecking, `npm run test:ci`, `npm run build`, and Playwright Chromium end-to-end checks before deploy jobs proceed.

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): current technical architecture, flows, infrastructure, and operational model
- [docs/LAUNCH_READINESS.md](docs/LAUNCH_READINESS.md): pre-launch checklist and environment rehearsal guide
- [AGENTS.md](AGENTS.md): repository instructions for coding agents

## Security Notes

- Invite codes are intended to be stored as hashes for lookup, with only KMS-encrypted ciphertext retained when admin recovery is needed.
- Secrets belong in AWS Secrets Manager or secure CI configuration, not in committed files.
- Production hosting stays behind CloudFront and private S3, with Cognito MFA for admin access and WAF or throttling controls on public RSVP traffic.
