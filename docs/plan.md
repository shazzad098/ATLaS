# ATLaS — Implementation Plan

PRD (v1.0, 17 Oct 2026) er sob module ekta **modular monolith + in-process async worker** hisebe banano hobe (PRD §8.1 er recommendation). Marketing site er visual design ZatiqEasy reference screenshot er moto replicate kora hobe, brand thakbe **ATLaS**.

## 1. Platform mapping (PRD baseline → actual stack)

PRD §8.3 te Next.js/NestJS/PostgreSQL/Redis/BullMQ/S3 recommend kora ache. Ei project Manus managed infrastructure e cholbe, tai equivalent mapping:

| PRD component | Ei project e |
| --- | --- |
| Frontend (Next.js/React, TS, Tailwind) | React 19 + Vite + TypeScript + Tailwind v4 + shadcn/ui (SPA), storefront SEO meta server-side inject |
| Backend (NestJS/TS) | Express + tRPC (web app er jonno) + REST `/api/v1` (mobile/3rd-party er jonno, OpenAPI spec soho) — duto e same service layer use korbe |
| PostgreSQL 16 | Managed MySQL (Drizzle ORM, migrations) — money column `decimal(14,2)`, kono float na |
| Redis + BullMQ | DB-backed `jobs` table + in-process worker (retry, exponential backoff), in-memory rate limiter + entitlement cache |
| S3 object storage | Manus storage (`/manus-storage/...`), assets table e size/quota tracking |
| Search | MySQL `LIKE`/fulltext based product search |
| Cloudflare edge / TLS | Domain module e DNS TXT/CNAME real verification; TLS status edge-adapter interface diye track |

## 2. Requirement interpretation (PRD er open decisions er default)

- **Auth**: PRD onujayi self-managed — email/phone signup + password (bcrypt), Bangladesh mobile OTP verification, passwordless OTP login, access JWT + rotating refresh token (sessions table), logout-all, optional TOTP 2FA (Super Admin & Pro). SMS provider na thakay SMS adapter er **sandbox driver** OTP ta in-app "Demo SMS inbox" e dekhabe; real provider (SSL Wireless/Twilio) pore plug-in kora jabe.
- **Payment gateways**: bKash, Nagad, SSLCommerz ar COD er common adapter interface. Real merchant credentials na thakay **sandbox adapter** — branded simulated gateway page, HMAC-signed webhook, idempotency, duplicate-safe callback, reconciliation. Credentials encrypted at rest (AES-256-GCM).
- **Courier**: Pathao, Steadfast, RedX, Paperfly + Manual — adapter interface, sandbox consignment/tracking, signed courier webhook. Third-party courier e 0.5% `courier_payment_charge` alada fee type.
- **Subdomain**: `store-slug.atlas.example` domain record auto-provision hobe; wildcard DNS na thakay storefront `/s/{slug}` path e live thakbe, ar host-based resolver ready thakbe (custom domain/wildcard point korle oi host e store render hobe).
- **Plan price** (PRD te "Business-approved"): placeholder — Basic ৳990/mo, Standard ৳2,490/mo, Pro ৳4,990/mo; yearly = 10 months price. Super Admin console theke edit kora jabe.
- **"Per sale"** = online payment PAID ba COD merchant-CONFIRMED order (first time). Cancel/full refund e fee void + usage counter reverse. Fee base = discount-adjusted merchandise subtotal (delivery & refunded line bad).
- **Domain policy**: Standard = custom domain (subdomain redirect), Pro = custom domain + subdomain duto ekshathe active.
- **Free theme policy**: sudhu 2 starter theme er moddhe select; Basic e select korar por active subscription e theme lock.
- **Lifecycle timing**: trial 7 din; period end e unpaid → PAST_DUE → (day 1) GRACE_PERIOD 7 din → READ_ONLY 7 din → SUSPENDED; retry day 1/3/5; reminder 7/3/1 din age. Testing er jonno Super Admin e "advance clock / run billing cycle" tool.
- **Multi-store**: ek account e multiple store (prottek store = alada tenant), workspace switcher.
- **Language**: Platform UI ar storefront label Bangla + English toggle; BDT; Asia/Dhaka timezone.
- **Demo data**: seed e Super Admin + demo merchant + 3 demo store (Nokshi/Bazar/Studio theme), products, orders — login credentials delivery te dewa hobe.

## 3. Surfaces & routes

**Marketing (public)**: `/` (screenshot replica + demo store preview, BD payment/courier story, testimonials, pricing teaser, FAQ, CTA, footer), `/pricing` (monthly/yearly toggle, quota, fee, comparison table, FAQ), `/templates` (category/industry/style/plan filter, comparison), `/templates/:code` (live preview, desktop/tablet/mobile responsive preview), `/how-it-works`, `/help`, `/help/:slug`, `/about`, `/contact` (support ticket form), `/terms`, `/privacy`, `/refund-policy`, `/developers` (REST API docs from OpenAPI).

**Auth & onboarding**: `/signup`, `/login`, `/verify-phone`, `/forgot-password`, `/invite/:token`, `/onboarding` (store name, category, logo, brand colors, address, contact, realtime slug check, plan + trial, theme), `/demo-sms` (sandbox SMS inbox).

**Merchant admin** `/app/*`: overview, products (+ new/edit, categories, CSV import dry-run, export), inventory ledger, orders (+ detail timeline, invoice print, refund), customers (+ profile, segments, blacklist, consent), discounts, design (theme select, settings, sections, navigation, draft/publish, desktop/mobile preview), payments, delivery, reports, staff & roles, billing, settings (business profile, domains, tax, policies, notifications, API keys & webhooks), support, notifications, account security (sessions, 2FA, deletion request).

**Storefront** `/s/:slug/*`: home (theme sections), shop (search, category filter, sort, pagination), category, product (variants), cart, checkout (COD / bKash / Nagad / SSLCommerz, coupon, delivery zone), order success + tracking, about, contact, policy pages, maintenance page (suspended), per-store sitemap/robots via `/api/storefront/:slug/sitemap.xml`.

**Super Admin** `/admin/*`: metrics (active stores, MRR, ARR, churn, GMV, funnel, storage, API health), merchants/stores (search, verify, suspend/restore, impersonation with reason+ticket+time-limit), plans & entitlements, themes (CRUD, version, rollout), payments & webhooks monitor, billing (subscriptions, invoices, fee ledger, refunds, settlement reconciliation), support tickets, announcements, security center (login events, suspicious activity, rate-limit hits, audit logs), jobs.

## 4. Backend module design

- **auth**: signup/login/OTP (hashed, 5 min expiry, 5 attempt cap, phone+IP rate limit), JWT access (15 min) + refresh rotation with reuse detection, sessions list/revoke, TOTP 2FA, CSRF header guard for cookie requests, login_events.
- **tenancy**: tenant = workspace = store boundary; `x-tenant-id` selector header, server membership verify kore `ctx.tenant` derive kore; sob query `tenantId/storeId` diye scoped; impersonation context audit-logged.
- **rbac**: roles (owner, manager, catalog, orders, support, viewer) → permission keys; staff invite via token; plan-wise seat limit.
- **entitlements (policy engine)**: plans.limits/features JSON → `assertFeature`, `assertQuota`, `assertWritable` (READ_ONLY/SUSPENDED block); cached snapshot, billing change e invalidate.
- **billing**: plans, subscriptions lifecycle state machine, usage_counters (monthly Asia/Dhaka), fee_ledger (order_overage, courier_payment_charge, gateway pass-through info), invoices + lines (order reference + rate), platform invoice payment via sandbox gateway, reminders, retries.
- **catalog/inventory**: products, variants (default variant always), images, categories, tags, SEO; inventory_movements ledger (reason soho, direct overwrite na); atomic reservation (`UPDATE ... WHERE stock-reserved >= qty`); CSV import validation + dry-run; export.
- **commerce**: carts, checkout (idempotency key, coupon, delivery zone, immutable snapshot), order state machine + order_events, returns, refund requests, customers (segments, blacklist, consent).
- **payments**: adapter registry (bkash/nagad/sslcommerz/cod), initiation, callback, webhook verification, `(provider,event_key)` unique idempotency, expiry & retry, reconciliation report, settlement status.
- **couriers/delivery**: zones, charges, courier connections (encrypted creds), shipments, tracking webhook.
- **themes**: registry + versions (JSON Schema via Ajv), store_themes draft/published (atomic publish), compatibility mapping on switch, Basic lock.
- **domains**: subdomain auto, custom domain TXT/CNAME verify (node dns), status pending/verified/active/failed/suspended, TLS status.
- **reports**: daily aggregation job, live metrics, async CSV export job → storage, PII permission.
- **notifications**: event bus → in-app notifications + email/SMS/WhatsApp-ready adapters (outbox table).
- **analytics**: event taxonomy table (signup_completed … plan_upgraded) → funnel metrics.
- **audit/support/announcements/api-keys/webhooks**: audit_logs, support_tickets + messages, announcements, hashed API keys with plan scopes & rate limit, merchant webhook endpoints with signed delivery + retry (SSRF guard).
- **REST v1**: PRD §11 er sob endpoint, request id, error envelope, cursor pagination, Idempotency-Key, plan-based rate limit, `/api/v1/openapi.json`.

## 5. Project structure

```
drizzle/schema.ts            — sob table (identity, store/theme, catalog, orders, payments/billing, ops)
server/_core/                — template core (express entry, vite, trpc init) + atlas context
server/lib/                  — money, crypto (AES-GCM, HMAC, TOTP), ids, time (Asia/Dhaka), errors, rateLimit
server/modules/<module>/     — service layer (auth, tenancy, rbac, entitlements, billing, catalog, inventory,
                               orders, checkout, customers, coupons, payments, couriers, themes, domains,
                               reports, notifications, analytics, audit, support, apiKeys, webhooks, jobs, seed)
server/routers/              — tRPC routers (public, auth, merchant/*, storefront, admin/*)
server/rest/                 — /api/v1 REST router + OpenAPI spec + webhooks
shared/                      — plan/feature keys, order states, theme contract types, i18n keys
client/src/i18n/             — bn/en dictionaries + provider
client/src/components/marketing|admin|storefront|common
client/src/themes/           — 7 theme definitions (tokens + layout variants) on one component contract
client/src/pages/marketing|auth|app|storefront|admin
```

## 6. Themes (Appendix A + plan pools)

Shared component contract: Header, Hero, CategoryGrid, ProductGrid, PromoBanner, Testimonials, TrustBar, Footer.
Nokshi (fashion, warm, large imagery — starter), Bazar (grocery, dense, category-first — starter), Studio (gadgets/cosmetics, whitespace, strong search — curated), Kantha (handicraft — curated), Dokan (general — curated), Rong (beauty — standard), Prestige (luxury — Pro-exclusive).
Free = Nokshi, Bazar · Basic = 5 curated · Standard = sob standard · Pro = sob + Prestige.

## 7. Design (reference replica)

Visual style reference screenshot theke neya — notun style select kora hocche na.

- **Palette**: primary `#155DFC` (CTA, bars, active toggles), page wash `#EFF6FF` → `#CFDEFF` hero gradient, emerald `#10B981` (COD/green gauge), mint glow `#CFF9EB`, teal demo banner `#B3E9E7`, ink `#0A0A0A`, muted `#6B7280`, white cards with soft shadow, 16–20px radius.
- **Typography**: "Inter Tight" (reference er custom grotesk er closest) — hero heading 400 weight large, section heading 500, body 400; Bangla text er jonno "Noto Sans Bengali".
- **Layout**: centered hero + 3-column dashboard stat mosaic, white logo tiles, 2-column feature card grid, full-width teal banner with tilted dashboard mockups, left-aligned steps section with curved arrows, testimonial marquee.
- **Signature elements**: outlined pill badge, glossy blue pill CTA with arrow, live-looking stat widgets (bar/donut/line/gauge charts).
- **Motion**: subtle fade-up on scroll, chart grow-in, marquee for logos/testimonials, hover lift on cards.
- **Admin & Super Admin**: same blue token set, clean sidebar dashboard (white surface, blue active state).
- **Images**: AI-generated product photos/banners for demo stores & theme previews, marketing mockups; customer logos as typographic tiles.
