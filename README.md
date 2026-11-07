# ATLaS — SaaS e-commerce store builder for Bangladesh

ATLaS lets a merchant go from signup to a live storefront without writing code: subdomain,
theme, catalog, orders, bKash/Nagad/SSLCommerz/COD, delivery zones, staff roles, plan-based
entitlements and per-order platform fees — all in one Next.js app.

It implements the PRD in `main.pdf` (v1.0) as a **modular monolith**: server components and
route handlers share one service layer under `src/lib/services`, so the dashboard and the REST
API enforce the same quota, permission and tenant rules.

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Server Actions, Route Handlers) + React 19 |
| Language | TypeScript, strict |
| Styling | Tailwind v4 with an in-repo token set (`src/app/globals.css`) |
| Data | PostgreSQL via Prisma 7 (`prisma/schema.prisma`, checked-in migrations) |
| Auth | Self-managed: bcrypt password + phone OTP (HMAC-stored), JWT access + rotating refresh sessions |
| Money | `Decimal(14,2)` in the DB; all arithmetic in integer paisa (`src/lib/money.ts`) |
| Validation | Zod at every boundary |
| Tests | `node:test` against the pure domain modules |

## Quick start

Requires Node 22+ (the test script relies on native TypeScript stripping; developed on Node 26).

```bash
npm install

# 1. Postgres (Docker; RLS needs a real Postgres connection)
docker compose up -d   # Postgres 16 on localhost:5432, volume atlas-db-data

cp .env.example .env   # set DATABASE_URL / AUTH_SECRET / OTP_HASH_SECRET

# 2. Schema + demo data
npm run db:migrate     # prisma migrate deploy (creates the RLS role + policies)
npm run db:seed        # demo tenants, products, orders, plans, users

# 3. Run
npm run dev
```

`npx prisma dev` also works for a quick look, but its local proxy multiplexes every
client onto one Postgres backend. Row-Level Security relies on transaction-local
session state, so the embedded database is not supported for RLS testing — use the
Docker Postgres above (or any real PostgreSQL 14+).

`npm run build` = `prisma generate && next build`. `npm run db:reset` drops and re-seeds.
`npm run integrations:check` reports which SMS/email/payment/courier/storage providers are
configured (or running in sandbox) without sending a real request.

### Demo accounts (seeded)

| Role | Phone | Password |
| --- | --- | --- |
| Super Admin | `01700000000` | `Atlas#2017` |
| Merchant (owns all demo stores) | `01711111111` | `Atlas#2017` |

Demo stores: `/store/nokshi-demo` (Nokshi theme, boutique), `/store/dhaka-bazar`
(Bazar theme, grocery, 76 seeded orders) and `/store/studio-demo` (Studio theme, gadgets
and personal care). OTP login works without an SMS provider: the code is
shown at `/demo-sms` and returned as `devCode` by the API.

### Buyer accounts

Shoppers sign up on a merchant's own storefront, not on the platform:
`/store/[slug]/account/signup` (phone OTP + password) and
`/store/[slug]/account/login`. Accounts are scoped to one store — the
`atlas_buyer` cookie carries the store id and is ignored on any other storefront.

The panel at `/store/[slug]/account` shows order history with tracking/invoice
links, saved wishlist, reviews and comments (verified-purchase badge when a
matching order exists), and the profile/delivery address used to prefill
checkout. A buyer can comment on the same product more than once: each
submission is kept as a new entry with its own rating, and older comments are
never overwritten. Guest checkout keeps working; creating an account later with
the same OTP-verified phone claims the existing order history.

### Row-Level Security

Merchant and buyer rows are protected in PostgreSQL, not only in application
code:

- `src/proxy.ts` verifies the access/buyer JWT and forwards a trusted
  `x-atlas-rls` header (any client-supplied copy is stripped).
- `src/lib/db.ts` starts a short transaction per query for authenticated
  sessions, runs `SET LOCAL ROLE atlas_app` and sets `app.user_id` /
  `app.customer_id` / `app.store_id` / `app.cart_key`.
- Policies in `prisma/migrations/20261102100000_enable_rls` and
  `20261102102000_rls_buyer_scope` restrict every tenant/store table to the
  caller's memberships or the buyer's own customer, orders, cart, wishlist and
  reviews.

Unauthenticated storefront requests, Super Admin requests, scripts and
migrations are the documented bypass contexts. `checkout` deliberately runs
with the platform client because it writes order/payment/fee rows across
table boundaries; its inputs are validated server-side and the buyer session
only affects prefill.

The `20261102101000_rls_runtime_role` migration creates the non-owner
`atlas_app` role and grants table/sequence/function access. The runtime
`DATABASE_URL` user must be able to `SET ROLE atlas_app` (the migration grants
it to the migration user). After a deploy, existing browser sessions must sign
in again so their access token carries the Super Admin claim.

## Security

- **Framework patches.** `next` is pinned to `16.4.5` (current npm `latest`, which already
  includes the 16.3.6 RCE fix). Dependabot keeps it and the rest of the tree patched;
  majors (Next, Prisma, ESLint, TypeScript) open as single PRs for manual review.
- **Dependency audit.** `npm audit` is clean (`0 vulnerabilities`). The remaining dev-only
  `minimatch` advisory under `typescript-eslint` is pinned to the fixed `11.0.1` through
  `overrides` in `package.json`. CI runs `npm audit --omit=dev --audit-level=high` on every
  push and PR, so a vulnerable production dependency fails the build.
- **Security headers** (`next.config.ts`): CSP (pinned origins, no frames/objects, inline
  scripts documented), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, COOP,
  `X-DNS-Prefetch-Control: off`, and HSTS (`max-age=63072000; includeSubDomains; preload`)
  in production. `poweredByHeader` is off. TLS is terminated at the edge/proxy.
- **Rate limiting** (PRD §13). `src/proxy.ts` applies a per-IP edge gate before routing:
  auth mutations (`/login`, `/login/2fa`, `/signup`, `/forgot-password`) allow 30 POSTs
  per 10 minutes; `/api/*` allows 120 requests per minute. Blocked requests get `429` with
  `Retry-After` and `X-RateLimit-Limit`. Inside the actions, login allows 20 attempts per
  IP and 10 per identifier per minute, and OTP allows 6 sends per phone/hour and 20 per
  IP/hour with 5 verification attempts per code. Swap `src/lib/rate-limit.ts` for Redis
  when running more than one instance.
- **Audit forwarding.** Every privileged or financial mutation is written to Postgres
  (`AuditLog`). Set `AUDIT_LOG_WEBHOOK_URL` (and optionally `AUDIT_LOG_WEBHOOK_TOKEN`) to
  mirror events as JSON to Loki/Datadog/Vector in real time and alert on
  `auth.login_failed` or `super_admin.impersonation.*`.
- **CI** (`.github/workflows/ci.yml`): production dependency audit, typecheck, lint, unit +
  tenant-isolation tests with coverage, a production build, and a Docker image build.
- **Reporting.** Email `security@atlas.example` with a description and reproduction steps;
  do not open a public issue for a live vulnerability.

## Surfaces

**Public** `/`, `/pricing`, `/themes`, `/how-it-works`, `/help`, `/contact`, `/about`,
`/terms`, `/privacy`, `/refund-policy`, `/developers`

**Auth** `/signup`, `/login`, `/forgot-password`, `/account`, `/onboarding`, `/demo-sms`

**Merchant admin** `/admin` — dashboard, orders (+ detail/timeline), products (+ CSV import,
dry-run), inventory ledger, categories, customers, design (theme + draft/publish), content
pages, delivery, payments, discounts, reports, staff, billing, support, settings

**Storefront** `/store/[slug]` — home, shop, product, cart, checkout, order tracking, policy pages,
buyer accounts (`/account`: dashboard, orders, reviews & comments, wishlist, profile)

**Super Admin** `/super-admin` — metrics, tenants, plans & entitlements, theme catalog (full-page
previews at `/theme-preview/[code]`), live platform notifications (`/super-admin/notifications`),
fee ledger, webhooks, security centre (audit log), support tickets

The notification bell is a live feed over the immutable `AuditLog`: every merchant update
(product, order, settings, theme, staff, billing, support) appears with actor, tenant and
action-specific detail, and polls every 12 seconds while the tab is visible.


**REST API v1** — see below; the OpenAPI document is at `/api/v1/openapi.json`.

## Merchant RBAC

Staff permissions are `resource:action` strings stored on the tenant's `Role` rows.
The five system roles (Owner, Admin, Manager, Staff, Support) are fixed; an Owner can
also create tenant-defined custom roles at `/admin/staff`.

- Navigation, page guards (`requirePermissionPage`) and every service call enforce the
  same permission list — hiding a link is never the only control.
- Custom-role management is Owner-only. No actor can grant a role that contains a
  permission they do not already hold, which blocks Admin → billing privilege escalation.
- Owner cannot be assigned through invite/role forms; ownership moves only through the
  explicit transfer flow.
- A permission the actor lacks redirects to `/admin/forbidden`, which explains the role
  and the missing permission.


## REST API

Base path `/api/v1`, session cookie or `Authorization: Bearer <accessToken>`, tenant from
`X-Tenant-Id` then the tenant cookie. Every response uses one envelope:

```json
{ "data": null, "error": { "code": "PLAN_LIMIT_REACHED", "message": "…" }, "meta": { "requestId": "req_…" } }
```

- Lists are cursor-paginated (`?limit=20&cursor=…` → `meta.nextCursor`).
- Mutations require `x-atlas-csrf` when cookie-authenticated; checkout/payment require `Idempotency-Key`.
- Errors are stable codes (`VALIDATION_FAILED`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`,
  `PLAN_LIMIT_REACHED`, `FEATURE_NOT_AVAILABLE`, `RATE_LIMITED`).

Endpoints: auth (`request-otp`, `verify-otp`, `refresh`, `logout`), `me`, stores, products,
orders, customers, themes, billing, public storefront (store/products/checkout) and the signed
payment webhook. `/developers` renders the same list from `src/lib/openapi.ts`, so docs and spec
cannot drift.

## How the rules are enforced

- **Tenancy** — `tenant_id` is derived from the caller's membership (`src/lib/tenant.ts`); a
  store id is always checked with `assertStoreAccess`. Payload tenant ids are ignored.
- **Entitlements** — the plan matrix (`src/lib/plans.ts`, overridden by the `Plan` rows) is
  snapshotted and cached per tenant; `readOnly`/`suspended` block writes, quotas block creates,
  and any billing change invalidates the snapshot immediately.
- **Money** — `src/lib/money.ts` (integer paisa). Overage fee base = discount-adjusted
  merchandise subtotal, delivery excluded; cancelling or fully refunding an order reverses the fee.
- **Orders** — the transition table is isolated in `src/lib/order-state.ts` and unit-tested;
  `applyTransition` writes an `OrderEvent` with actor + timestamp and snapshots line data.
- **Payments** — sandbox adapters per provider, HMAC-signed callbacks, `(provider, eventKey)`
  uniqueness so a duplicate callback cannot pay twice; invalid signatures leave the payment pending.
- **Couriers** — one adapter per provider in `src/lib/couriers` (Pathao/RedX/Steadfast). Sandbox
  is used unless a provider's credentials exist (`COURIER_MODE=auto|sandbox|live`); the merchant's
  Store ID is stored on `DeliveryMethod`. Consignments and tracking updates pass through one order
  bridge, and `/api/v1/webhooks/couriers/[provider]` verifies an HMAC/token and de-duplicates events.
- **Audit** — privileged mutations write `AuditLog` rows (visible at `/super-admin/audit`).

## Checks

```bash
npm run typecheck     # tsc --noEmit
npm run lint          # eslint (Next app)
npm test              # unit suite — no database required
npm run test:db       # service + RLS integration suite (needs DATABASE_URL)
npm run test:coverage # full suite with coverage thresholds (CI gate)
npm run test:e2e      # HTTP smoke suite against a running server
npm run build         # prisma generate && next build
```

**Two test layers.** `npm test` covers the pure domain modules (money, plans,
dates, order state machine, RBAC, slugs, phone/OTP, rate limiting, i18n). It
never touches the database, so it stays fast and can run anywhere.

`npm run test:db` adds the integration suite, which is where the money lives:

| Suite | What it pins down |
| --- | --- |
| `src/lib/services/checkout-service.test.ts` | totals and snapshots, stock reservation, coupons, idempotent replay (including two simultaneous requests), disabled gateways, unpublished stores |
| `src/lib/services/payment-service.test.ts` | a signed callback settles once, replays are duplicates, a forged signature changes nothing, an amount mismatch never credits |
| `src/lib/services/billing-service.test.ts` | Free never gets invoiced or suspended, unpaid renewal → grace → read-only, settlement restores the storefront, one trial per workspace |
| `src/lib/services/order-service.test.ts` | cancel/return restock correctly, illegal transitions are refused, timeline events are written |
| `src/lib/rls.test.ts` | the Postgres policies actually isolate tenants and buyers, and the bypass is the only cross-tenant path |
| `src/lib/tenant.test.ts` | `assertStoreAccess` refuses another tenant's store and hides archived ones |
| `src/lib/services/payment-collection.test.ts` | COD collection marks the order paid; refunds settle, void the fee and refuse over-refunds |
| `src/lib/rls-coverage.test.ts` | every tenant/store/customer-scoped table has forced RLS; every policy is bound to a context helper |
| `src/lib/openapi.test.ts` | every implemented route is documented and every documented path exists |

The coverage test is a drift detector rather than a scenario test: it found
`ImpersonationSession` sitting outside RLS, which
`prisma/migrations/20261106120000_rls_impersonation_session` fixes.

The integration suite needs a migrated database and creates/removes its own
tenants, so point `DATABASE_URL` at a disposable one:

```bash
docker compose up -d
npm run db:migrate
npm run test:db
```

Tests import the app's `@/…` modules directly through
`scripts/register-ts-paths.mjs` (a Node resolver hook), so the same files run
under `node --test` without a bundler. CI applies migrations with
`prisma migrate deploy` — never `db push` — and then runs both layers.

**End to end.** `src/e2e/smoke.test.ts` drives a running instance over HTTP and
covers what the other layers cannot: the proxy's host routing, the security
headers, the API envelope on the wire, and the seeded storefront rendering. It
skips unless `E2E_BASE_URL` is set; the CI `e2e` job builds the app, seeds a
database, starts `next start`, waits for `/api/v1/health`, then runs it.

**Coverage.** `npm run test:coverage` fails the build below 70% lines, 55%
branches and 45% functions (current: 80.7 / 69.2 / 50.9), so a change that
shrinks the tested surface cannot land silently.


## Repository layout

```
prisma/            schema, migrations, seed
src/app/           routes: (marketing), (auth), onboarding, admin, super-admin, store, api/v1
src/app/admin/_actions/  merchant action bodies (actions.ts is the `"use server"` barrel)
src/lib/           domain logic: money, plans, entitlements, rbac, tenant, audit, auth, openapi
src/lib/services/  business services shared by pages, server actions and the REST API
src/components/ui/ shared presentational primitives
docs/              plan.md, TODO.md, notes-*.md, operations docs and audit reports
```

## Recently shipped

- **TOTP 2FA** — authenticator-app setup with one-time recovery codes and an attempt-limited,
  single-use login challenge (`/account`, `src/lib/auth/two-factor.ts`).
- **Self-service integrations** — scoped API keys and HMAC-signed outbound merchant webhooks,
  manageable from `/admin/developers`.
- **Analytics events** — append-only `AnalyticsEvent` table with a `trackEvent` emitter for the
  storefront funnel and platform milestones (signup, store created, trial, plan changes).
- **Bangla/English UI toggle** — cookie-backed locale with a shared dictionary for the app shell
  (`src/lib/i18n`); the marketing pages (home, how it works, pricing, themes, about, help, contact,
  developers) and the legal documents (terms, privacy, refund) carry their Bangla and English copy
  side by side and pick it on the server, so the toggle switches whole pages rather than only the
  chrome. Merchant-entered content is never translated.

See `docs/TODO.md` for the full requirement status board.
