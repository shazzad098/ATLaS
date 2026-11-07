# ATLaS operations runbook

This is the production checklist for the platform team. It complements the PRD
NFRs and the audit fix list.

## 1. Deploy pipeline

- GitHub Actions (`.github/workflows/ci.yml`) applies the migration chain to an
  ephemeral PostgreSQL instance (`prisma migrate deploy`, never `db push`), then
  runs typecheck, lint, the unit suite, the service + RLS integration suite, a
  production build, and a Docker image build.
- Deployment is `prisma generate && next build`, then `prisma migrate deploy` as
  a release step. Never run `migrate reset` against production.
- `Dockerfile` builds Next's `standalone` output in three stages and runs it as
  the unprivileged `nextjs` user with a `/api/v1/health` HEALTHCHECK. Build-time
  secrets are placeholders; the runtime receives the real values. Because the
  runtime image does not include the Prisma CLI, migrations run from the release
  step (or `kubectl exec`/`docker exec` against an image that does).
- `prisma db seed` refuses to run with `NODE_ENV=production` unless
  `SEED_PASSWORD` is explicitly set. Demo credentials from the README are for
  local/CI only.
- Scheduled jobs are declared in `vercel.json` and must carry
  `Authorization: Bearer $CRON_SECRET`:
  - `GET /api/cron/billing` — subscription lifecycle, daily 02:00.
  - `GET /api/cron/reports` — daily rollup + due scheduled exports, daily 02:15.
  - `GET /api/cron/webhooks` — outbound webhook retries, every 5 minutes.

## 1a. Rate limiting

- The per-IP edge gate in `src/proxy.ts` is awaited and goes through
  `src/lib/rate-limit.ts`, which is pluggable: `RATE_LIMIT_DRIVER=memory`
  (default, one instance) or `redis` with `UPSTASH_REDIS_REST_URL` /
  `UPSTASH_REDIS_REST_TOKEN` for a fleet-wide window.
- A failing or slow remote store degrades to the local window and logs
  `rate limit store unavailable`; it never fails the request it protects.
- Per-action limits inside handlers (`rateLimit()` in `src/lib/api.ts`) stay
  in-process on purpose: an extra network round trip per handler costs more than
  the burst protection it adds. The edge gate is the global ceiling.

## 2. Observability

- `src/instrumentation.ts` validates the mandatory secrets at boot and forwards
  errors raised while rendering Server Components / route handlers /
  server actions to `reportError()` — the paths the per-route `route()` wrapper
  never sees.
- All API failures are logged as newline-delimited JSON by `src/lib/logger.ts`
  with a request id. Set `SENTRY_DSN` to forward exceptions to Sentry through its
  store endpoint (no SDK dependency).
- `GET /api/v1/health` is public and returns database latency, process uptime,
  RSS/heap and the deploy commit. Point uptime monitors at it; alert when
  `database` is `down` or `databaseLatencyMs` exceeds 500ms for 5 minutes.
- Suggested alerts:
  - 5xx rate > 1% for 5 minutes.
  - Webhook `DEAD` deliveries > 10 in an hour.
  - Billing sweep missing its daily run.
  - Disk/storage usage > 85%.
  - `rate limit store unavailable` appearing in logs (Redis down → per-instance
    limits only).

## 3. Backup and restore

- **RPO:** 24 hours (nightly logical backup).
- **RTO:** 4 hours for a full restore into a replacement database.
- Backups: `scripts/backup.sh` runs `pg_dump --format=custom`, verifies the
  archive, and prunes files older than `BACKUP_RETENTION_DAYS`.
- Restore drill: `scripts/restore.sh <dump>` into a scratch database. Do this
  monthly and record the result. Never restore over production without a
  snapshot/point-in-time recovery point.
- Store backups outside the application host (object storage with versioning).
  Encrypt at rest and restrict access to the operator role.

## 4. Incident runbook

1. **Acknowledge** the alert and open an incident channel. Post the suspected
   customer impact and the current deploy SHA.
2. **Stabilise:** if the latest deploy is implicated, roll back to the previous
   build. Do not attempt schema rollbacks during an incident; migrations are
   forward-only.
3. **Diagnose:** query `/api/v1/health`, platform logs (filter by request id),
   Sentry, and the Super Admin overview (tenants, orders, MRR, webhook failures).
4. **Communicate:** post an initial update within 15 minutes, then every 30
   minutes until resolved. Use the status page/announcement channel.
5. **Recover:** if data is corrupted, restore to a scratch database, verify
   counts, then schedule a controlled cutover.
6. **Postmortem:** within 48 hours, document timeline, root cause, customer
   impact, and follow-up actions with owners.

## 5. Tenant isolation checks

- `src/lib/rls.test.ts` connects as the runtime role (`SET LOCAL ROLE atlas_app`)
  and asserts that a merchant sees only its own stores, products and orders, that
  a buyer sees only its own history, that an unauthenticated role sees nothing,
  and that `app.bypass=on` is the only cross-tenant path. CI runs it against the
  migrated database on every push.
- `src/lib/tenant-isolation.test.ts` additionally checks the application-level
  scoping for webhook endpoints and export jobs.
- Every mutation must go through `assertStoreAccess()` / `assertPermission()` or
  a service that does. API keys inherit explicit scopes only.

## 6. Load testing

```bash
k6 run -e BASE_URL=https://staging.example -e STORE_SLUG=nokshi \
  loadtest/k6-storefront.js
```

Thresholds: storefront HTML p95 < 500ms, API health p95 < 800ms, failure rate
< 1%. Run before major launches and after changes to catalog/storefront queries.

## 7. Storage

- Local disk is the default (`UPLOAD_DIR`, default `public/uploads`). Production
  should use the S3-compatible driver (`STORAGE_DRIVER=s3`).
- Quotas are enforced on exact bytes at upload time. Orphan objects are cleaned
  when a product image is replaced.
- Back up the bucket with versioning enabled; local-disk deployments must include
  `public/uploads` in the host snapshot.

## 8. Integration readiness

Run this before promoting a build to production:

```bash
npm run integrations:check
```

It checks database connectivity, auth/OTP secrets, `SECRETS_KEY`, `CRON_SECRET`,
SMS/email endpoints, payment gateway credentials, courier mode and storage. It
does not send a real provider request. In production, missing critical values
exit non-zero; sandbox payment/courier warnings are expected until merchant
onboarding is complete.

Live integration smoke test order: staging credential → signed webhook simulator
→ small-value real payment/refund → courier booking → only then production
credentials. Never paste production credentials into a local `.env`.

## 9. Docker smoke test

The production image builds without a database because `prisma generate` and
`next build` use compile-time placeholder secrets:

```bash
docker build -t atlas:ci .
```

Full smoke test against a disposable database:

```bash
docker network create atlas-net
docker run -d --name atlas-db --network atlas-net \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=atlas \
  postgres:16-alpine
docker run -d --name atlas-app --network atlas-net -p 3100:3000 \
  -e DATABASE_URL='postgres://postgres:postgres@atlas-db:5432/atlas?sslmode=disable' \
  -e AUTH_SECRET='change-me-32-characters-minimum!!' \
  -e OTP_HASH_SECRET='change-me-32-characters-minimum!!' \
  -e SECRETS_KEY='change-me-32-characters-minimum!!' \
  -e CRON_SECRET='smoke-test-cron' \
  -e NEXT_PUBLIC_APP_URL='http://localhost:3100' \
  atlas:ci
docker exec atlas-app npx prisma migrate deploy
docker exec -e SEED_PASSWORD='change-me' atlas-app npm run db:seed   # optional demo data
curl -fsS http://localhost:3100/api/v1/health
```

Expect `status: "ok"` and `database: "up"`. Remove the containers/network after
the test; keep only the image if you are deploying it.

## 10. Row-Level Security

Database policies enforce tenant/buyer isolation in addition to the application
checks. `src/proxy.ts` verifies the JWT and sets a trusted `x-atlas-rls` header;
`src/lib/db.ts` runs authenticated queries in a short transaction as the
non-owner `atlas_app` role with `SET LOCAL` context. Public storefront traffic,
Super Admin traffic, scripts and migrations use the owner role and are the
documented bypass contexts.

Deployment checklist:

- Use a real PostgreSQL 14+ server. The `prisma dev` proxy multiplexes clients
  onto one backend, so it cannot isolate transaction-local session state.
- Run `npm run db:migrate` (`prisma migrate deploy`). The RLS migrations create
  `atlas_app`, enable/force policies, and grant table/sequence/function access.
- The **runtime** database user must be able to switch to the role:
  `GRANT atlas_app TO <runtime_user>;` (the migration grants it to the user that
  ran the migration; repeat if those users differ).
- Do not add tables outside the migration chain without also granting them to
  `atlas_app` (`ALTER DEFAULT PRIVILEGES` covers tables created by the same
  migration user).
- Existing browser sessions must sign in again after the upgrade so the access
  token includes the Super Admin claim used to select the platform context.

Quick verification after a request is served:

```sql
-- inside an authenticated merchant request, the effective role is atlas_app
SELECT current_user;                 -- atlas_app
SELECT current_setting('app.user_id', true);
```

### Cost of the RLS wrap

Authenticated queries run inside a short transaction that switches the role and
sets the context, so every query pays four extra round trips (BEGIN, context,
COMMIT). Measured locally against PostgreSQL 16:

| Path | ms/query |
| --- | --- |
| plain `SELECT 1` | 1.7 |
| BEGIN + `SET ROLE` + context + query + COMMIT (old) | 7.4 |
| BEGIN + one context statement + query + COMMIT (current) | 5.2 |

Folding `SET LOCAL ROLE` into the `set_config` statement removed one round trip;
`src/lib/rls.test.ts` asserts that the merged statement still switches the
effective role to `atlas_app`. The remaining ~3.5 ms is the transaction itself.

If a page gets slow, the next step is one transaction per request (a unit of
work) rather than per query — that needs an `after()` cleanup and a larger pool,
and should be driven by a load test (`loadtest/k6-storefront.js`), not by
speculation.

Checkout runs with the platform client because it writes customer/order/payment/
fee/webhook rows across table boundaries; it is fully server-validated. Merchant
and buyer pages, API reads and mutations stay under RLS.
