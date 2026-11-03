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
npm test              # node --test on src/**/*.test.ts (52 tests)
npm run build         # prisma generate && next build
```

Unit tests cover money rounding/rates, slug rules (including Bangla transliteration), the plan
matrix, Dhaka-time date helpers, and the order state machine.

## Repository layout

```
prisma/            schema, migrations, seed
src/app/           routes: (marketing), (auth), onboarding, admin, super-admin, store, api/v1
src/lib/           domain logic: money, plans, entitlements, rbac, tenant, audit, auth, openapi
src/lib/services/  business services shared by pages, server actions and the REST API
src/components/ui/ shared presentational primitives
docs/              plan.md, TODO.md, notes-*.md, operations docs and audit reports
```

## Not built yet

2FA/TOTP, self-service API keys + outbound merchant webhook management, the analytics event table,
and the full Bangla/English UI toggle. See `docs/TODO.md` for the per-item detail.
