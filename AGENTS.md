# Repository Instructions

These instructions apply to coding agents working in this repository.

## Project Goal

Maintain a secure, simple, cost-effective wedding announcement and RSVP website for Matt and Alison's 2027 wedding.

Source-of-truth documentation:

- `docs/ARCHITECTURE.md` for current system shape, flows, and constraints
- `docs/LAUNCH_READINESS.md` for launch and environment verification

## Working Expectations

- When execution is allowed, implement the requested work instead of stopping at suggestions.
- Keep changes scoped to the request and preserve unrelated user work.
- Prefer existing repository patterns over new abstractions.
- Keep architecture simple, tested, secure, and cost effective.
- Prefer AWS serverless primitives unless there is a clear reason not to.
- Do not introduce unnecessary services, always-on infrastructure, or speculative abstractions.

## Documentation Expectations

- Treat documentation as part of the product, not as an afterthought.
- When a request touches documented behavior, update the relevant docs in the same change.
- Question, fix, or remove documentation and instructions that are outdated, unnecessary, misleading, or ill-advised.
- Describe the current implemented system unless a document explicitly exists for future planning.

## Testing Expectations

- Run relevant unit or integration tests before final response when application code changes.
- Run relevant end-to-end tests before final response when UI behavior changes.
- For visual or interaction work, use the available browser or Playwright tooling in this environment to verify behavior.
- If tests cannot be run, explain what was not verified and why.

Required testing areas include:

- validation, invite-code handling, and backend business logic
- RSVP and admin API behavior
- homepage, RSVP flow, admin login and dashboard, exports, and SPA routing

Documentation-only changes do not require application test runs unless non-documentation files are modified.

## Security Expectations

- Store RSVP invite-code hashes for guest lookup and, when recoverability is needed, store only KMS-encrypted invite-code ciphertext.
- Keep secrets in AWS Secrets Manager or secure CI secrets.
- Do not commit plaintext secrets, guest data, or production invite codes.
- Plaintext invite codes may appear only in authenticated admin responses, invitation CSV exports, and outgoing invitation emails. Never log them or store them raw in DynamoDB or environment variables.
- Use least-privilege IAM policies.
- Require HTTPS.
- Keep S3 buckets private.
- Protect admin functionality with Cognito and MFA.
- Use generic invalid invite-code errors so guest existence is not leaked.

## Cost Expectations

- Prefer on-demand and pay-per-use services.
- Avoid idle compute, NAT gateways, managed relational databases, and container platforms unless justified.
- Keep observability useful but proportionate to a low-traffic wedding site.
- Revisit optional cost items, such as CloudFront access logs or extra WAF managed rules, before launch.
