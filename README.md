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

# 1. Local Postgres (no Docker needed)
npx prisma dev start atlas        # prints DATABASE_URL — copy it into .env
cp .env.example .env              # then set DATABASE_URL / AUTH_SECRET / OTP_HASH_SECRET

# 2. Schema + demo data
npm run db:migrate                # prisma migrate deploy
npm run db:seed                   # demo tenants, products, orders, plans, users

# 3. Run
npm run dev
```

`npm run build` = `prisma generate && next build`. `npm run db:reset` drops and re-seeds.

### Demo accounts (seeded)

| Role | Phone | Password |
| --- | --- | --- |
| Super Admin | `01700000000` | `Atlas#2017` |
| Merchant (owns both demo stores) | `01711111111` | `Atlas#2017` |

Demo stores: `/store/nokshi-demo` (Nokshi theme, boutique) and `/store/dhaka-bazar`
(Bazar theme, grocery, 76 seeded orders). OTP login works without an SMS provider: the code is
shown at `/demo-sms` and returned as `devCode` by the API.

## Surfaces

**Public** `/`, `/pricing`, `/themes`, `/how-it-works`, `/help`, `/contact`, `/about`,
`/terms`, `/privacy`, `/refund-policy`, `/developers`

**Auth** `/signup`, `/login`, `/forgot-password`, `/account`, `/onboarding`, `/demo-sms`

**Merchant admin** `/admin` — dashboard, orders (+ detail/timeline), products (+ CSV import,
dry-run), inventory ledger, categories, customers, design (theme + draft/publish), delivery,
payments, discounts, reports, staff, billing, support, settings

**Storefront** `/store/[slug]` — home, shop, product, cart, checkout, order tracking, policy pages

**Super Admin** `/super-admin` — metrics, tenants, plans & entitlements, theme catalog, fee
ledger, webhooks, security centre (audit log), support tickets

**REST API v1** — see below; the OpenAPI document is at `/api/v1/openapi.json`.

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
- **Audit** — privileged mutations write `AuditLog` rows (visible at `/super-admin/audit`).

## Checks

```bash
npm run typecheck     # tsc --noEmit
npm run lint          # eslint (Next app; legacy Vite starter trees are ignored)
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
notes-progress.md  build log kept during the implementation
TODO.md            requirement-by-requirement status board
```

`client/`, `server/`, `shared/`, `drizzle/` and `vite.config.ts` are the unused Manus/Vite
starter and are excluded from `tsconfig.json` and ESLint.

## Not built yet

2FA/TOTP, self-service API keys + outbound merchant webhook management, third-party courier
consignment APIs (Pathao/Steadfast/RedX/Paperfly), the analytics event table, and the full
Bangla/English UI toggle. See `TODO.md` for the per-item detail.
