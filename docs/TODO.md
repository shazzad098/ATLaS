# ATLaS — requirement status board

Legend: `[x]` delivered · `[~]` partial (gap noted) · `[ ]` not built.
Evidence is a route or module in this repository, verified with `npm run typecheck`,
`npm run lint`, `npm test`, `npm run build` and an HTTP walkthrough.

## 1. Marketing website (PRD 4.1)

- [x] Homepage: value proposition, dashboard-style hero, feature grid, demo store previews,
      three-step onboarding, theme gallery, plan teaser, payment/courier story, demo
      testimonials, FAQ, CTA, footer — `src/app/(marketing)/page.tsx`
- [~] Visual replica of the reference screenshot: layout and section order match, but the
      shipped palette is the teal/emerald token set rather than the reference blue, and the
      animated stat mosaic is represented by static cards.
- [~] Template catalog: `/themes` lists every theme with industry/style/tier and swatches, but
      has no category/style filters and no responsive (desktop/tablet/mobile) preview frame.
      Live per-store preview is available at `/store/[slug]`.
- [x] Pricing: monthly/yearly figures, quotas, overage, comparison matrix, fee semantics, FAQ —
      `/pricing` (data from `pricingMatrix()`)
- [x] How it works: six steps with timing + FAQ — `/how-it-works`
- [x] Help centre — `/help`; Terms `/terms`; Privacy `/privacy`; Refund/cancellation
      `/refund-policy`; Contact form creates a platform support ticket `/contact`; About
      `/about`; Developers `/developers`
- [x] Site-wide nav + footer link every public page (`src/app/(marketing)/layout.tsx`)

## 2. Authentication & account (FR-01, §13)

- [x] Phone signup with OTP verification, email/password or phone/password login, passwordless
      OTP login — `src/app/(auth)/*`, `src/lib/auth/otp.ts`
- [x] Session management: JWT access, rotating refresh token (single use), session list,
      "logout other sessions", logout-all — `/account`, `src/lib/auth/session.ts`
- [ ] Optional TOTP 2FA for Super Admin and Pro merchants
- [x] Account deletion request with retention window + cancel — `/account`,
      `requestAccountDeletion`
- [x] bcrypt password hashing, HMAC OTP storage, 5-attempt lock, per-phone/hour and per-IP rate
      limits, double-submit CSRF guard, audit entries for login and reset
- [x] Rate-limited REST login: `POST /api/v1/auth/request-otp`, `/verify-otp`, `/refresh`, `/logout`

## 3. Merchant onboarding & multi-tenancy (4.2, FR-02, US-01)

- [x] Onboarding form: business name, category, logo, brand colour, address, contact
- [x] Realtime slug availability, duplicate rejected, reserved words blocked — `/api/v1/…`
      `checkSlug` helper + onboarding action
- [x] Trial activation, plan choice, default theme, store pages, delivery zones, COD method and
      onboarding checklist created with the store
- [x] Store is the tenant boundary; every query is scoped server-side (`src/lib/tenant.ts`)
- [x] Workspace/store switcher for accounts with multiple stores — `/admin/_components/store-switcher.tsx`

## 4. Subscription, entitlements & fee ledger (§5, US-02, US-03, US-06)

- [x] Four-plan matrix (products 25/250/1,000/∞, orders 50/500/2,000/∞, overage
      2.5/2/1/0%, storage, themes, switching policy, domain, seats, coupons, reports, courier,
      API, support, yearly, 7-day trial) — `src/lib/plans.ts`, editable in `/super-admin/plans`
- [x] Entitlements enforced server-side on every write; cached snapshot invalidated on billing
      change — `src/lib/entitlements.ts`
- [x] US-02: product quota blocks create/import with an upgrade message; existing rows stay
      editable; upgrade raises quota immediately
- [x] US-03: included/consumed quota visible (`/admin`, `/admin/billing`); fee ledger rows per
      eligible order with order reference and rate; cancelled/full-refund reverses fees;
      invoice lines show the aggregate
- [x] Fee semantics: paid or merchant-confirmed COD, discount-adjusted merchandise base,
      delivery excluded, courier fee as a separate type
- [x] Lifecycle TRIALING → ACTIVE → PAST_DUE → GRACE → READ_ONLY → SUSPENDED → CANCELLED with a
      daily sweep, reminders at 7/3/1 days and retries on day 1/3/5 — `runBillingSweep`
- [x] Invoices, payment method screen, upgrade/downgrade, monthly/yearly — `/admin/billing`

## 5. Storefront (4.3, Appendix A)

- [x] Mobile-first home, shop (search/filter/sort/pagination), product, cart, checkout, order
      success + tracking, contact/about and policy pages under `/store/[slug]`
- [x] Seven themes on one section contract (Header, Hero, CategoryGrid, ProductGrid, PromoBanner,
      Testimonials, TrustBar, Footer) — `src/lib/theme-catalog.ts`, `src/themes/*`
- [x] Theme settings (logo, colours, fonts, banners, navigation, blocks) with JSON-schema
      validation and atomic publish (`/admin/design`)
- [x] Variants with SKU/price/stock, coupons, COD + bKash/Nagad/SSLCommerz checkout, guest
      checkout, phone lookup for tracking
- [~] Order notifications: in-app + outbox/email/SMS adapter interfaces exist, but no live
      provider is configured (sandbox logs instead)
- [~] SEO: title/description per store and product, but no per-store sitemap.xml/robots and no
      Open Graph image generation
- [ ] Bangla/English UI label toggle (all copy is Bangla; no dictionary switcher)

## 6. Merchant admin (4.4)

- [x] Overview with revenue, orders, pending work, low stock, quota usage, checklist
- [x] Products CRUD, archive, variants, images, SEO fields, CSV import with dry-run + export,
      categories, tags, inventory ledger with reasons (`/admin/products`, `/admin/inventory`)
- [x] Atomic stock reservation during checkout (`reserveStock` inside the order transaction)
- [x] Orders: ten statuses, timeline, payment status, notes, refund/return flow, immutable line
      snapshot, actor + timestamp events (`/admin/orders/[orderId]`)
- [x] Customers: directory with lifetime value, search; blacklist flag honoured at checkout
- [~] Customer segments (new/repeat/VIP/inactive) are computed ad hoc, not saved as segments;
      consent JSON is stored but has no management UI
- [x] Discounts: percentage/fixed, minimum cart, usage cap, date range; advanced campaigns gated
      by plan
- [x] Design: theme select, settings, draft save, publish, desktop/mobile preview, Basic lock
- [x] Payments: gateway connect (secrets encrypted), transaction list, fee breakdown
- [x] Delivery: zones, charges, free-delivery threshold
- [x] Reports: sales, products, order status, payment method, CSV export (`/admin/reports`)
- [x] Staff & roles with plan seat limits and invitations (`/admin/staff`)
- [x] Settings: profile, domains (TXT/CNAME verification, TLS status), tax, policies,
      notifications, API keys placeholder (`/admin/settings`)
- [x] Notification centre and support tickets (`/admin/notifications`, `/admin/support`)

## 7. Payments (FR-05, US-05)

- [x] bKash, Nagad, SSLCommerz adapters behind one interface + COD as a first-class method
- [x] Unique transaction reference, callback/webhook verification, duplicate-safe via
      `(provider, eventKey)`, failed signature leaves payment pending, merchant notification
- [x] Idempotency keys, retry/switch method, pending-payment expiry, reconciliation view in
      `/super-admin/webhooks` and `/super-admin/fees`

## 8. Super Admin console (4.5)

- [x] Platform metrics (stores, MRR/ARR, GMV, fee revenue, funnel, storage, API health)
- [x] Tenant search, suspend/restore with reason, plan and entitlement configuration
- [x] Theme catalog CRUD and rollout (`/super-admin/themes`)
- [x] Webhook + payment monitor (`/super-admin/webhooks`), fee/invoice ledger (`/super-admin/fees`)
- [x] Support tickets and announcements; security centre with audit log, OTP/session/webhook
      counters (`/super-admin/tickets`, `/super-admin/audit`)
- [~] Impersonation: the audit trail reserves `super_admin.impersonation.*` and the security
      centre lists it, but there is no start/stop impersonation control yet.

## 9. REST API & integrations (§11)

- [x] `/api/v1` auth (request-otp, verify-otp, refresh, logout), me, stores, products, orders,
      customers, themes, billing, public storefront (store, products, product, checkout) and the
      payment webhook
- [x] OpenAPI 3.1 document at `/api/v1/openapi.json`, rendered at `/developers`
- [x] Cursor pagination, `requestId`, `Idempotency-Key`, consistent error envelope, per-plan
      request-rate limits, webhook signature verification
- [ ] Self-service API keys and outbound merchant webhook endpoints (schema + UI)
- [x] Courier consignment integrations (Pathao/RedX/Steadfast): sandbox-first adapters with
      live HTTP clients, merchant Store ID per courier, consignment creation from the order page,
      manual tracking sync, signed courier webhook with idempotency, order status bridge
      (SHIPPED/DELIVERED/RETURN_REQUESTED) and the 0.5% courier fee on shipment presence —
      `src/lib/couriers`, `src/lib/services/courier-service.ts`,
      `/api/v1/webhooks/couriers/[provider]`, Admin → ডেলিভারি / অর্ডার

## 10. Platform policies & quality

- [~] Bangla UI throughout, BDT, Asia/Dhaka; English labels exist in code comments/docs but
      there is no runtime language switch
- [ ] Analytics event taxonomy (signup_completed … plan_upgraded) — no events table/emitter
- [x] Appendix B defaults: 7-day trial without card, 7-day grace, retries 1/3/5, 5 MB image cap
      with MIME check, 60 req/min base rate limit, soft-deleted products, immutable financial rows
- [x] Upload MIME/size validation; audit log for every admin/platform mutation
- [x] Seed: Super Admin, demo merchant, two complete demo stores with products, coupons, orders
- [x] Validation pass: typecheck, lint, 52 unit tests, production build, HTTP walkthrough of the
      marketing pages, REST API, contact form → Super Admin ticket flow

## Verification (last run)

```
npm run typecheck   ✔ 0 errors
npm run lint        ✔ 0 errors (legacy Vite starter trees excluded)
npm test            ✔ 52 pass / 0 fail
npm run build       ✔ all routes compiled
HTTP walkthrough    ✔ 10 public pages 200, 18 OpenAPI paths, 32 API assertions,
                       contact form → /super-admin/tickets visible, plans/webhooks/audit render
```
