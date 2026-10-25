# ATLaS — SaaS E-commerce Store Builder

ATLaS is a multi-tenant Bangladesh-focused e-commerce SaaS built with Next.js 16, React 19, TypeScript, Prisma 7 and PostgreSQL. It supports merchant storefronts, catalog/inventory, COD and gateway adapters, coupons, orders, subscriptions, platform fees and Super Admin operations.

## Local development

```bash
cp .env.example .env
npm ci
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

The local database is Prisma's zero-install Postgres (`prisma dev`, server name `atlas`,
data in `%LOCALAPPDATA%\prisma-dev-nodejs`). It is **not** a background service, so it stops
on reboot. `npm run dev` now probes `DATABASE_URL` and starts it automatically when the host is
`localhost`; use `npm run dev:web` to skip that check.

| Command | Purpose |
| --- | --- |
| `npm run db:start` | Start the local Postgres (idempotent, safe while it is already running) |
| `npm run db:stop` | Stop it without deleting data |
| `npm run db:status` | Show the `prisma dev` servers and their URLs |

**Troubleshooting:** `Can't reach database server at 127.0.0.1:51214` (or the "ডাটাবেসে সংযোগ
করা যাচ্ছে না" page) means the local Postgres is stopped, not that the credentials are wrong.
Run `npm run db:start` and reload — seed data and sessions are preserved.

The application is available at `http://localhost:3000`. Keep `.env` private. For local development without live gateway credentials, payment adapters use the sandbox callback flow.

## API service (`api/`)

The platform API is a NestJS service that takes over server-side surface area one module at a
time; the Next.js app stays the frontend and keeps its server actions until a module is migrated.

| Command | Purpose |
| --- | --- |
| `npm run api:install` | Install API dependencies (first checkout, or after `api/package.json` changes) |
| `npm run api:dev` | `nest start --watch` on `http://localhost:4000/api` |
| `npm run api:build` / `npm run api:start` | Production build / run (`api/dist/main.js`) |
| `npm run api:typecheck` / `npm run api:lint` | Strict TypeScript check / ESLint |
| `npm --prefix api test` | Jest unit tests + Supertest e2e (needs the dev database running) |
| `npm --prefix api run test:unit` / `test:e2e` | Run only one suite |

- `GET /api/health` is the liveness probe (no dependencies); `GET /api/health/db` is the
  readiness probe and returns **503** when Postgres is unreachable.
- OpenAPI/Swagger UI: `http://localhost:4000/api/docs` (JSON at `/api/docs-json`). Disabled in
  production unless `API_DOCS_ENABLED=true`.
- The API shares the root `.env`, the root `prisma/schema.prisma` and the root migration
  history. `api/prisma/schema.prisma` is a generated copy (synced automatically on install /
  before generate / dev / build) — edit the root schema only.
- TypeScript runs in strict mode plus `noUncheckedIndexedAccess`, `noImplicitOverride`,
  `noImplicitReturns` and `noUnused*`.
- Override `API_PORT` (default `4000`) and `API_ALLOWED_ORIGINS` (default
  `http://localhost:3000`) in `.env` when needed.

### Auth (`/api/auth`)

Tokens are compatible with the Next.js app: the same `AUTH_SECRET`, HS256, issuer `atlas`, and
audience `atlas-app`, plus the same `atlas_at` / `atlas_rt` / `atlas_csrf` cookies. A session
created by either surface authenticates against the other.

| Endpoint | Behaviour |
| --- | --- |
| `POST /api/auth/login` | Phone/email + password (bcrypt), 8 attempts per 15 min per IP+identifier. Sets httpOnly cookies; returns the access token in the body. |
| `POST /api/auth/refresh` | Rotates the refresh token (stored only as SHA-256 hash) and mints a new 1-hour access token. Requires `X-CSRF-Token` when the token comes from a cookie. |
| `POST /api/auth/logout` | Revokes the presented session and clears cookies (idempotent, 204). |
| `POST /api/auth/logout-all` | Revokes every active session for the authenticated user. |
| `GET /api/auth/me` | Bearer token or `atlas_at` cookie; verifies the session row so revocation is immediate. |

Request bodies are validated by DTOs + `class-validator` (whitelist, unknown fields rejected
with 400), and every error keeps Nest's JSON envelope (`statusCode`, `message`, `error`).

### Background jobs (BullMQ + Redis)

`api/src/queue` runs one Redis queue (`atlas-events`) with an in-process BullMQ worker. Login
enqueues an `audit.record` job that the worker persists to `AuditLog`, so the HTTP response
never waits for the audit write. The queue is optional: with no `REDIS_URL` (or
`QUEUE_ENABLED=false`) the API boots normally, jobs are skipped with a warning, and
`GET /api/health/queue` reports `disabled`. If Redis dies mid-flight, `enqueueAudit` logs and
drops the job rather than failing the request.

```bash
npm run redis:start    # start the local Redis (idempotent)
npm run redis:status   # is the configured endpoint reachable?
npm run redis:stop     # graceful shutdown (AOF is preserved)
```

Local Redis on Windows is the portable `redis-windows` build unpacked to
`%LOCALAPPDATA%\atlas-redis\Redis-<version>\`; data lives in `%LOCALAPPDATA%\atlas-redis-data`.
`npm run api:dev` starts it automatically when the binary is present. Production points
`REDIS_URL` at a managed instance and should run the worker as a separate process once the API
scales beyond one node.

| Endpoint | Behaviour |
| --- | --- |
| `GET /api/health/queue` | `{ status: "ok", waiting, active, delayed, failed }`, `disabled` without Redis, `error` when unreachable |

Job defaults: 3 attempts with exponential backoff, completed jobs kept for 1h (max 1000),
failed jobs for 24h (max 5000) so a broken job is still inspectable.

## Verification commands

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

`npm test` runs the checked-in regression suite under `src/**/*.test.ts`. The legacy `client/` and `server/` directories are retained as historical scaffold files and are not part of the current Next.js runtime or lint scope.

## Production deployment

1. Provision PostgreSQL 16+ and set `DATABASE_URL`.
2. Set strong, independently generated `AUTH_SECRET`, `OTP_HASH_SECRET` and `CRON_SECRET` values.
3. Set `NEXT_PUBLIC_APP_URL`, `APP_ROOT_DOMAIN` and storefront domain configuration.
4. Configure the selected SMS/email/payment/courier providers; do not enable a merchant payment method until its credentials are configured.
5. Run `npm ci`, `npm run db:generate`, `npm run db:migrate`, and `npm run build`.
6. Start with `npm run start` behind TLS and a reverse proxy.
7. Configure a scheduler to `POST /api/internal/cron/billing` with `Authorization: Bearer $CRON_SECRET` at least every 15 minutes. This runs billing lifecycle transitions and expires abandoned online checkouts, releasing stock and coupon reservations.

All API responses use a consistent envelope. API routes include `x-request-id`, security headers, idempotency support for checkout, database-backed rate limiting and tenant authorization. Payment webhooks require provider signature verification and are claimed idempotently before applying order side effects.

## Important operational notes

Database migrations are checked in under `prisma/migrations/`; never use `prisma db push` in production. Before enabling real payments, test successful, failed, duplicate, amount-mismatch, timeout and refund callbacks in staging. Configure application logs and an external error/metric sink for production observability.
