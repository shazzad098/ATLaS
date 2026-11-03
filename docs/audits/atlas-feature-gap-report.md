# ATLaS — PRD বনাম বর্তমান কোড Feature-gap Audit

**Audit date:** 22 October 2026  
**Repository:** `D:\Projects\ATLaS`

## গুরুত্বপূর্ণ সীমাবদ্ধতা

এই workspace-এ `main.pdf` পাওয়া যায়নি। `D:\Projects\ATLaS` এবং `D:\Projects`-এর নিচে কোনো PDF-ও পাওয়া যায়নি। রিপোর `notes-reference.md`-এ মূল PRD-এর উৎস হিসেবে `/home/ubuntu/upload/main.pdf` লেখা আছে, কিন্তু সেই path এই Windows device-এ অ্যাক্সেসযোগ্য নয়। তাই নিচের audit-টি করা হয়েছে:

- `TODO.md`-এর requirement status board
- `plan.md`, `notes-progress.md`, `notes-reference.md`, `README.md`
- বর্তমান `src/`, `prisma/`, route handlers এবং service layer
- TypeScript, unit test, lint এবং production build verification

Exact PDF-to-code traceability দরকার হলে `main.pdf` আবার এই workspace-এ upload করতে হবে।

## Executive summary

ATLaS-এর core MVP অনেকটাই সম্পন্ন: authentication, multi-tenancy, onboarding, subscription/entitlement, catalog/inventory, storefront, checkout, sandbox payment flow, order/refund, admin console, themes, REST/OpenAPI, support এবং audit-এর বড় অংশ বাস্তবায়িত আছে।

তবে PRD অনুযায়ী এখনও **৪টি বড় feature সরাসরি অনুপস্থিত**, **৫টি feature আংশিক**, এবং **কিছু planned route/surface missing**। Launch readiness-এর জন্য অগ্রাধিকার হবে:

1. Self-service API keys + outbound merchant webhooks
2. Courier integrations এবং shipment/consignment lifecycle
3. TOTP 2FA
4. Analytics event taxonomy ও event storage
5. Runtime Bangla/English toggle
6. SEO sitemap/robots/OG image
7. Super Admin impersonation control
8. Customer segments/consent management

## 1. সম্পূর্ণ অনুপস্থিত feature — P0/P1

### 1.1 TOTP 2FA — P0 security gap

`TODO.md`-এ এটি `[ ]` হিসেবে আছে। বর্তমান account page-এ password, sessions ও account deletion আছে, কিন্তু 2FA setup/verify/disable বা recovery code UI নেই। বর্তমান `User` schema-তেও TOTP secret, enabled flag বা recovery code model নেই।

**যা যোগ করতে হবে:**

- Pro merchant এবং Super Admin-এর জন্য TOTP enrollment
- QR/otpauth URI এবং confirmation challenge
- Login flow-এ second factor enforcement
- Recovery codes, regeneration ও one-time usage
- Disable করার আগে password + TOTP confirmation
- Audit events: enabled, disabled, failed challenge, recovery used
- নতুন device/session policy এবং rate limiting

**Acceptance criteria:** TOTP চালু করলে password/OTP login একা account access দিতে পারবে না; Super Admin account-এর জন্য এটি বাধ্যতামূলক করা যাবে।

### 1.2 Self-service API keys — P0 integration gap

`/admin/settings`-এ API key control নেই; settings form-এও API key management নেই। Prisma schema-তে `ApiKey` model নেই। API authentication বর্তমানে session cookie/Bearer access token-নির্ভর।

**যা যোগ করতে হবে:**

- API key create/revoke/rotate/list UI
- Raw secret একবারই দেখানো; DB-তে শুধু hash
- Key name, prefix, scopes, last-used, expiry, revokedAt
- Plan অনুযায়ী scope ও request-rate enforcement
- Secret leakage প্রতিরোধ এবং audit log
- REST docs-এ API key authentication

### 1.3 Outbound merchant webhooks — P0 integration gap

বর্তমানে payment webhook inbound path আছে (`/api/v1/webhooks/payments/[provider]`) এবং `WebhookDelivery` model আছে, কিন্তু merchant-owned webhook endpoint configuration নেই। `WebhookEndpoint`/subscription model নেই; event selection, signing secret, retry/dead-letter UI নেই।

**যা যোগ করতে হবে:**

- Merchant webhook endpoint CRUD
- Event subscription: order, payment, refund, inventory, customer ইত্যাদি
- HMAC signing secret rotation
- SSRF protection, HTTPS enforcement এবং private-IP blocking
- Delivery queue, exponential retry, timeout, dead-letter/replay
- Delivery log: response code, latency, attempts, last error
- Test webhook / replay action
- API key বা plan entitlement-এর সঙ্গে scope/rate-limit binding

### 1.4 Third-party courier integrations — P0 commerce gap

বর্তমানে delivery zones এবং `COURIER_THIRD_PARTY` fee type আছে, কিন্তু Pathao/Steadfast/RedX/Paperfly-এর connection, consignment, shipment, tracking বা courier webhook model/service নেই। Prisma schema-তে courier connection বা shipment model নেই।

**যা যোগ করতে হবে:**

- Courier credential connection, encrypted at rest
- Provider adapter interface: quote, create consignment, cancel, track
- Shipment/consignment record ও order linkage
- Merchant order page থেকে courier booking
- Signed courier webhook এবং status mapping
- Public tracking page ও customer notifications
- COD amount reconciliation
- Provider failure হলে manual fallback
- Basic+ plan gating এবং 0.5% courier fee ledger behavior

### 1.5 Analytics event taxonomy — P1 product/metrics gap

`signup_completed` থেকে `plan_upgraded` পর্যন্ত event taxonomy-এর কোনো event table বা emitter নেই। Super Admin funnel metrics থাকলেও durable event stream/data model নেই।

**যা যোগ করতে হবে:**

- `AnalyticsEvent`/event log model
- Standard events: signup, phone verified, onboarding completed, store published, first product, first order, payment success, trial conversion, plan upgraded/cancelled
- Actor/store/tenant/session/source metadata
- PII minimization ও retention policy
- Idempotency key/unique event key
- Daily aggregation job ও funnel queries
- Super Admin metrics-এর সঙ্গে event source wiring

## 2. আংশিক feature — P1/P2

### 2.1 Bangla/English runtime toggle — P1

`StoreSettingsForm`-এ `bn`/`en` locale select আছে, কিন্তু UI copy runtime dictionary থেকে আসে না; অধিকাংশ app/admin/storefront text hardcoded Bangla। `TODO.md`-ও এটিকে partial/not built হিসেবে চিহ্নিত করেছে।

**Gap:** locale save করা যায়, কিন্তু locale অনুযায়ী page labels, validation message, email/SMS copy বা storefront content বদলায় না।

**প্রস্তাবিত কাজ:**

- `bn` ও `en` dictionary + provider
- User preference বনাম store preference আলাদা করা
- Server-side locale resolution
- Validation/error/toast/notification translation
- Storefront SEO metadata-এর localized version
- Bangla text-এর পাশাপাশি English fallback

### 2.2 Storefront SEO — P1

Store/product SEO title, description ও OG image URL field আছে, কিন্তু:

- Per-store sitemap.xml নেই
- Per-store robots.txt নেই
- Dynamic Open Graph image generation নেই
- `proxy.ts` sitemap/robots path bypass করে, কিন্তু corresponding dynamic route দেখা যায় না

**প্রস্তাবিত কাজ:** `/api/storefront/[slug]/sitemap.xml`, `/api/storefront/[slug]/robots.txt` বা equivalent route; product/store metadata থেকে canonical URL, OG/Twitter card এবং image generation।

### 2.3 Customer segments ও consent UI — P1

Customer list/search, lifetime value এবং blacklist আছে। কিন্তু segments new/repeat/VIP/inactive ad hoc calculation-নির্ভর; saved segment entity নেই। `consentJson` schema-তে আছে, কিন্তু consent management UI নেই।

**প্রস্তাবিত কাজ:**

- Saved segment CRUD ও dynamic criteria
- Segment count/refresh/export
- New/repeat/VIP/inactive default segments
- Consent purpose, source, timestamp, opt-out history
- Marketing communication preference ও audit trail
- PII export/delete permission boundary

### 2.4 Super Admin impersonation — P1 operations gap

Audit log-এ `super_admin.impersonation.*` action reserved/listed আছে, কিন্তু start/stop impersonation control নেই। বর্তমান admin UI-তে reason, ticket reference, expiry সহ impersonation session শুরু করার workflow দেখা যায় না।

**প্রস্তাবিত কাজ:**

- Tenant/store নির্বাচন করে time-limited impersonation
- বাধ্যতামূলক reason + support ticket reference
- Banner/visual indicator: “You are impersonating …”
- Destructive action block বা explicit confirmation
- Stop impersonation এবং session expiry
- সব action actor + effective user + tenant context সহ audit

### 2.5 Notification providers — P2 production integration gap

In-app notification এবং email/SMS/WhatsApp adapter interface/outbox আছে, কিন্তু live provider configured নয়; sandbox log/demo behavior ব্যবহৃত হচ্ছে। এটি MVP test flow-এর জন্য ঠিক, কিন্তু production launch-এর আগে provider credentials, delivery retry, unsubscribe এবং template management দরকার।

## 3. Planned route/surface mismatch

`plan.md`-এর surface list-এর সঙ্গে actual route list মিলিয়ে নিচের mismatch পাওয়া গেছে:

| Planned surface | বর্তমান অবস্থা | মন্তব্য |
|---|---|---|
| `/templates` | `/themes` আছে | নাম ও URL mismatch; planned category/industry/style/plan filter নেই |
| `/templates/:code` | নেই | আলাদা responsive live preview route নেই; store preview অন্য route-এ |
| `/help/:slug` | নেই | শুধু `/help` index page আছে |
| `/verify-phone` | নেই | signup-এর ভেতরে OTP step আছে; PRD যদি standalone route চায়, তা অনুপস্থিত |
| `/invite/:token` | নেই | staff invite acceptance-এর dedicated public route নেই |
| `/api/storefront/:slug/sitemap.xml` | নেই | SEO requirement অসম্পূর্ণ |
| Merchant API key UI/route | নেই | self-service integration অসম্পূর্ণ |
| Merchant webhook endpoint UI/route | নেই | outbound webhook management অসম্পূর্ণ |
| Courier connection/shipment UI/route | নেই | শুধু delivery zone/fee layer আছে |

এগুলো সবসময় backend feature gap নয়—কিছু naming/surface gap—তবে PRD acceptance test যদি exact URL ধরে, তাহলে route compatibility যোগ করতে হবে।

## 4. Marketing/reference visual gap

`TODO.md` অনুযায়ী homepage-এর section order ও content মোটামুটি আছে, কিন্তু reference screenshot-এর সঙ্গে এখনও দুটো পার্থক্য আছে:

- shipped palette reference blue token set-এর বদলে teal/emerald-heavy
- animated stat mosaic static cards হিসেবে আছে

Theme catalog-এ theme metadata ও swatch আছে, কিন্তু category/style filters এবং desktop/tablet/mobile preview frame নেই। এটি core commerce blocker নয়, তবে marketing/PRD parity-এর জন্য P2।

## 5. যেগুলো ইতিমধ্যে ভালোভাবে আছে

বর্তমান code audit-এ নিম্নোক্ত core areas বাস্তব implementation হিসেবে পাওয়া গেছে:

- Phone OTP signup/login, password login/reset, rotating refresh session
- Session list, revoke, logout-all, CSRF guard, rate limiting
- Store onboarding, slug validation, multi-store/workspace switching
- Plan matrix, quota/feature enforcement, trial ও subscription lifecycle
- Fee ledger, invoice, overage/courier fee semantics, refund reversal
- Storefront home/shop/product/cart/checkout/order tracking
- Seven-theme contract, draft/publish, schema validation, plan gating
- Product/variant/category CRUD, CSV import dry-run/export, inventory ledger
- Atomic stock reservation ও order state machine/timeline
- Coupons, delivery zones, payment methods, refund/return flow
- bKash/Nagad/SSLCommerz/COD sandbox adapter, signed payment callback, idempotency
- Merchant admin, reports/export, staff roles/invitations, support/notifications
- Super Admin metrics, tenants, plans, themes, fees, webhooks, audit
- REST v1, cursor pagination, request IDs, error envelope, OpenAPI page

## 6. Verification result

এই audit session-এ চালানো হয়েছে:

- `npm.cmd run typecheck` — **PASS**, 0 errors
- `npm.cmd test` — **PASS**, 52/52 tests
- `npm.cmd run lint` — **PASS**, 0 errors; **7 warnings** (unused variables/unused action parameters in account/admin actions)
- `npm.cmd run build` — default Turbopack-এ internal process-spawn panic, `globals.css` processing পর্যায়ে
- `npm.cmd exec next build -- --webpack` — Webpack compilation এবং TypeScript phase সফল; page-data collection-এ local Prisma endpoint `127.0.0.1:51214`-এ `EACCES` দেখা গেছে, কারণ এই session-এ DB service reachable নয়।

অতএব code compile health ভালো, কিন্তু default build pipeline ও DB-backed production build verification আলাদাভাবে ঠিক করা দরকার।

## 7. Recommended implementation order

### Sprint 1 — Security ও integration foundation

1. TOTP 2FA + recovery codes
2. API key model/service/UI
3. Webhook endpoint model/service/queue/retry/security
4. Courier adapter contract + shipment/consignment schema

### Sprint 2 — Commerce operations ও measurement

5. Pathao/Steadfast/RedX/Paperfly adapters
6. Analytics event table/emitter/aggregation
7. Customer saved segments + consent management
8. Super Admin impersonation with strict audit/expiry

### Sprint 3 — Customer-facing parity

9. Runtime BN/EN dictionary switch
10. Sitemap, robots, canonical/OG metadata
11. Template catalog filters and responsive preview route
12. Missing invite/help/verify-phone compatibility routes

### Production hardening

13. Live SMS/email/WhatsApp provider configuration
14. Real payment/courier credential verification and reconciliation drills
15. Fix lint warnings
16. Ensure DB-backed build/preview environment is available
17. Add integration/e2e tests for 2FA, webhook retries, courier status transitions, sitemap and localization

## Final verdict

**Core MVP:** প্রায় production-shaped এবং testable।  
**PRD completeness:** পুরোপুরি সম্পূর্ণ নয়। সবচেয়ে বড় বাকি scope হলো API/webhooks, courier integrations, 2FA এবং analytics।  
**Launch blocker:** যদি PRD-এর “platform for real merchants/integrators” scope ধরা হয়, তাহলে Sprint 1-এর চারটি item শেষ না করে public launch করা উচিত নয়। Sandbox-only demo release হিসেবে বর্তমান implementation ব্যবহারযোগ্য।
