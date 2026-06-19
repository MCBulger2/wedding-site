# Repository Instructions

These instructions apply to all future coding agents working in this repository.

## Project Goal

Build a secure, simple, cost-effective wedding announcement and RSVP website for Matt and Alison's 2027 wedding.

The accepted architecture is:

- React + Vite frontend.
- AWS serverless backend.
- Route 53 custom domain.
- CloudFront and private S3 frontend hosting.
- API Gateway HTTP API.
- Lambda handlers.
- DynamoDB on-demand data storage.
- Cognito admin authentication.
- AWS CDK v2 infrastructure as code.
- GitHub Actions CI/CD using AWS OIDC.

See `docs/PROJECT_PLAN.md` for the full project plan.

## Working Expectations

- When execution is allowed, implement requested functionality rather than stopping at suggestions.
- Keep architecture clean, simple, tested, secure, and cost effective.
- Prefer AWS serverless primitives unless there is a clear reason not to.
- Do not introduce needless abstractions, unnecessary services, or always-on infrastructure.
- Follow existing project patterns once the application is scaffolded.
- Keep changes scoped to the user's request.
- Preserve user changes and never revert unrelated work.

## Testing Expectations

- Always run relevant unit tests before final response when application code changes.
- Always run relevant end-to-end tests before final response when UI behavior changes.
- Use Playwright MCP to interact with and debug the UI when visual or interaction behavior is involved.
- If tests cannot be run, clearly explain why and what remains unverified.

Required testing areas include:

- Unit tests for validation, RSVP authorization, invite-code handling, and backend logic.
- Integration tests for RSVP and admin API behavior.
- End-to-end tests for the homepage, RSVP flow, admin login/dashboard, CSV export, and SPA routing.

## Security Expectations

- Store only hashed RSVP invite codes.
- Keep secrets in AWS Secrets Manager or secure CI secrets.
- Do not commit plaintext secrets, guest data, or production invite codes.
- Use least-privilege IAM policies.
- Require HTTPS.
- Keep S3 buckets private.
- Protect admin functionality with Cognito and MFA.
- Use generic errors for invalid invite codes so guest existence is not leaked.

## Cost Expectations

- Prefer on-demand and pay-per-use services.
- Avoid idle compute, NAT gateways, managed relational databases, and container platforms unless justified.
- Keep observability useful but proportionate to a low-traffic wedding site.
- Revisit optional cost items, such as CloudFront access logs or WAF managed rules, before launch.
