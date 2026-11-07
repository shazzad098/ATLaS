# Security policy

## Reporting a vulnerability

Email **security@atlas.example** with a description, reproduction steps and the
affected route. Do not open a public issue for a live vulnerability. We aim to
acknowledge within two working days.

## Scope

In scope: the web application, the REST API (`/api/v1`), the authentication and
session handling, tenant isolation, payment and courier webhooks, and the
container image.

Out of scope: findings that require a compromised merchant account to exploit
within its own tenant; missing security headers on responses that carry no
session; reports produced only by an automated scanner without a proof of
concept.

## Baseline controls

| Area | Control |
| --- | --- |
| Passwords | bcrypt, minimum length enforced by the signup schema |
| Sessions | short-lived HS256 access JWT + rotating refresh token stored as a SHA-256 hash; compare-and-swap rotation |
| Second factor | TOTP with one-time recovery codes |
| CSRF | double-submit cookie for cookie-authenticated mutations; bearer requests exempt |
| Tenant isolation | Postgres Row-Level Security with a non-owner runtime role, plus application-level `assertStoreAccess` |
| Webhooks | HMAC/token verification, `(provider, eventKey)` idempotency, reject-and-record on bad signature |
| Payments | a gateway callback is never trusted; bKash is re-verified with `execute`/`status` |
| Secrets | gateway credentials encrypted at rest with `SECRETS_KEY`; boot-time validation in `src/instrumentation.ts` |
| Rate limits | distributed per-IP edge gate (`RATE_LIMIT_DRIVER`) + per-action burst limits |
| Audit | privileged and financial mutations write `AuditLog`, optionally mirrored to a collector |
| Dependencies | `npm audit --omit=dev --audit-level=high` fails CI; Dependabot keeps the tree patched |

Known accepted risks are tracked in `docs/TODO.md` and the audits under
`docs/audits/`. Two are deliberate: the CSP still allows `'unsafe-inline'`
scripts until the nonce pipeline lands, and per-action rate limits are
per-instance by design (the edge gate is the global ceiling).
