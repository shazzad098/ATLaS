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

Seeding is production-safe: it creates plans, the theme catalogue and the super admin only.
Set `SEED_DEMO_DATA=1` before `npm run db:seed` when you want the three development demo
stores (Nokshi, Dhaka Bazar, Studio) populated as well.

`npm run dev` starts everything local development needs: the Prisma Postgres database, the
local S3-compatible server (product images), the Nest API and the Next.js web app. If you prefer
separate terminals, run `npm run dev:web` and `npm run api:dev` yourself; the API is reused when
it is already listening on `API_INTERNAL_URL`.

The local database is Prisma's zero-install Postgres (`prisma dev`, server name `atlas`,
data in `%LOCALAPPDATA%\prisma-dev-nodejs`). It is **not** a background service, so it stops
on reboot. `npm run dev` probes `DATABASE_URL` and starts it automatically when the host is
`localhost`.

| Command | Purpose |
| --- | --- |
| `npm run db:start` | Start the local Postgres (idempotent, safe while it is already running) |
| `npm run db:stop` | Stop it without deleting data |
| `npm run db:status` | Show the `prisma dev` servers and their URLs |

**Troubleshooting:** `Can't reach database server at 127.0.0.1:51214` (or the "ডাটাবেসে সংযোগ
করা যাচ্ছে না" page) means the local Postgres is stopped, not that the credentials are wrong.
Run `npm run db:start` and reload — seed data and sessions are preserved.

The application is available at `http://localhost:3000`. Keep `.env` private. For local development without live gateway credentials, payment adapters use the sandbox callback flow.

Product images upload directly to S3 from the browser using a presigned URL. Local development
runs `s3rver` on `http://127.0.0.1:9000` (auto-started by `npm run dev`; manage it with
`npm run s3:start` / `npm run s3:stop`). Production points the same `S3_*` variables at
Cloudflare R2 or AWS S3.

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

### Catalog & uploads (Nest)

`/api/catalog/*` (JWT) exposes tenant-scoped stores, categories and products (create/list/update),
mirroring the Next.js catalog service with server-side membership + `catalog:write` permission
checks. Product image uploads go through `POST /api/storage/presign` (see below); the admin product
form now has an **আপলোড** button that uploads straight to S3/R2 and fills the public URL.

### Email

`EmailService` (`api/src/notifications/email`) is pluggable: `EMAIL_PROVIDER=resend` (HTTP API),
`EMAIL_PROVIDER=smtp` (Nodemailer), or unset for a logging sandbox. Returns a uniform
`{ ok, provider, messageId }` and never throws.

### Worker & rate limiting

The BullMQ worker runs in-process by default; set `QUEUE_RUN_WORKER=false` and run
`npm run api:worker` (`dist/worker.js`) to scale it independently. Login throttling is Redis-backed
(atomic fixed-window INCR/EXPIRE) when `REDIS_URL` is set, falling back to an in-memory limiter.

### Tests

`npm test` (web) runs unit + adapter tests (payments: initiate/callback/refund/signature with a
stubbed fetch) and integration tests (`src/e2e`) for checkout idempotency and order-status
transitions against the seeded database. The API suite (`npm --prefix api test`) covers auth,
catalog, storage, queue, throttle and email with Jest + Supertest.

### Object storage (S3 / R2)

`POST /api/storage/presign` (JWT, see Swagger) verifies the caller's membership in the store's
tenant and returns a 5-minute presigned PUT URL, the generated object key (`stores/<storeId>/…`)
and the final public URL. Type (JPEG/PNG/WebP/GIF) and size (≤ 5 MB) are signed into the URL, so a
client cannot upload anything else. `GET /api/storage/status` reports whether it is configured; the
API refuses to boot in production without `S3_*` variables.

### Error monitoring

Set `SENTRY_DSN` to enable Sentry in both processes: the web app through
`src/instrumentation.ts` (`register` + `onRequestError`), the API through `Sentry.init` plus the
global exception filter (5xx only). Without a DSN everything is a no-op, so local development and
CI need no account.

## Verification commands

```bash
npm run typecheck     # web
npm run lint          # web
npm test              # web unit suite
npm run build         # production build
npm --prefix api test # API unit + e2e (needs Postgres + Redis)
npm run api:typecheck
npm run api:lint
npm run api:build
```

`npm test` runs the checked-in regression suite under `src/**/*.test.ts`. The legacy `client/` and
`server/` directories are retained as historical scaffold files and are not part of the current
Next.js runtime or lint scope. CI (`.github/workflows/ci.yml`) runs all of the above against
throwaway Postgres 16 + Redis 7 services on every push and pull request.

## Production deployment

### 1. Required environment

The process refuses to start when a production variable is missing or unsafe
(`src/lib/env.ts` → `assertRuntimeEnv`, `api/src/config/env.ts` → `assertApiRuntimeEnv`).

| Variable | Rule |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 16+, SSL enabled for managed hosts |
| `AUTH_SECRET` | ≥ 32 random chars, shared by web + API |
| `OTP_HASH_SECRET` | ≥ 32 random chars |
| `SECRETS_KEY` | ≥ 32 random chars (never the dev default) |
| `CRON_SECRET` | ≥ 16 random chars, used by the scheduler bearer token |
| `NEXT_PUBLIC_APP_URL` | must be `https://…` |
| `SMS_PROVIDER` + `SMS_API_KEY` | required (otherwise OTP codes would be echoable) |
| `S3_ENDPOINT`/`S3_BUCKET`/`S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY`/`S3_PUBLIC_BASE_URL` | API only; required for merchant image uploads |
| `REDIS_URL` | API only; required for background jobs |
| `SENTRY_DSN` | optional, enables error reporting in web + API |

Generate secrets with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
Never commit `.env`; use your platform's secret manager in production.

### 2. Build & run

```bash
npm ci
npx prisma generate
npx prisma migrate deploy        # never `prisma db push` in production
npm run build
npm start                        # behind TLS (HSTS is sent in production)

# API (separate process)
npm --prefix api ci
npm --prefix api run build
node api/dist/main.js            # or: npm run api:start
```

### 3. Docker Compose (reference stack)

```bash
cp .env.example .env             # fill in the table above + POSTGRES_PASSWORD
docker compose -f docker-compose.prod.yml up -d --build
```

Services: `postgres` (health-checked), `redis` (AOF, `noeviction`), `migrate` (runs
`prisma migrate deploy` once), `api` (port 4000) and `web` (port 3000). The web and API containers
run as the unprivileged `node` user.

### 4. Scheduler

`POST /api/internal/cron/billing` with `Authorization: Bearer $CRON_SECRET` at least every 15
minutes. It runs billing lifecycle transitions, expires abandoned online checkouts (releasing stock
and coupon reservations) and delivers pending webhooks.

### 5. Error monitoring & storage

- Set `SENTRY_DSN` (web: server instrumentation + `onRequestError`; API: global exception filter,
  5xx only). Without a DSN both are no-ops.
- Image uploads: `POST /api/storage/presign` (JWT) returns a 5-minute presigned PUT URL plus the
  final `publicUrl`; the browser uploads directly to R2/S3. Content type (JPEG/PNG/WebP/GIF) and
  size (≤ 5 MB) are signed into the URL, and the object key is generated under `stores/<storeId>/`
  after verifying tenant membership.

### 6. Operational checklist

- Database backups + a tested restore procedure.
- Uptime probes on `/api/health` (web) and `/api/health/db` + `/api/health/queue` (API).
- TLS termination and a single trusted proxy hop (both apps read `x-forwarded-for`).
- Rotate `AUTH_SECRET` (invalidates every session) and provider credentials on a schedule.
- Keep Redis `noeviction`; BullMQ jobs are lost if eviction removes queue keys.

All API responses use a consistent envelope. API routes include `x-request-id`, security headers,
idempotency support for checkout, database-backed rate limiting and tenant authorization. Payment
webhooks require provider signature verification and are claimed idempotently before applying order
side effects.

## Important operational notes

Database migrations are checked in under `prisma/migrations/`; never use `prisma db push` in production. Before enabling real payments, test successful, failed, duplicate, amount-mismatch, timeout and refund callbacks in staging. Configure application logs and an external error/metric sink for production observability.
