# ATLaS — PRD বনাম Repository Audit Report

**Repository:** `shazzad098/ATLaS`  
**Reviewed commit/working tree:** cloned from GitHub during this review  
**Reviewed documents:** `main.pdf`, `ATLaS-PRD.pdf`  
**Review date:** 23 October 2026  
**Scope:** PRD coverage, implementation completeness, correctness risks, security boundaries, production readiness, build/test health

## Executive verdict

ATLaS-এর বর্তমান repository একটি শক্তিশালী **MVP prototype / early beta foundation**, কিন্তু এটি এখনো PRD-এর সব requirement পূরণ করা **production-ready complete product নয়**। Core merchant flow—tenant scoping, onboarding-এর basic অংশ, product/catalog, inventory reservation, order state machine, COD/online payment adapter structure, coupon, theme draft/publish, staff roles, billing primitives, support ticket এবং Super Admin shell—অনেকটাই তৈরি আছে।

তবে release-এর আগে কিছু blocker ঠিক করা জরুরি। বিশেষ করে:

1. `npm test` সফল দেখালেও আসলে **০টি test চালিয়েছে**।
2. Payment initiation ব্যর্থ হলে stock reservation, pending order এবং coupon usage-এর cleanup নেই।
3. Order transition transaction-এ বর্তমান status conditional ভাবে যাচাই করা হয় না; simultaneous cancel/payment/confirm race-এ stock ও order history অসঙ্গত হতে পারে।
4. Billing sweep কেবল Super Admin button থেকে চালানো যায়; কোনো real scheduler/worker/cron integration নেই।
5. Paid subscription renewal বাস্তবে payment method/automatic charge নয়—invoice manually “paid” করা যায়। Suspended store payment-এর পরে স্বয়ংক্রিয়ভাবে পুনরায় publish হয় না।
6. Customer-facing SMS/email/WhatsApp order confirmation wired নয়; notification code মূলত in-app এবং email/SMS adapter placeholder।
7. PRD-এর REST API surface-এর ছোট অংশ আছে; auth request/verify, billing, integrations, API keys, courier webhook, OpenAPI docs ইত্যাদি অনুপস্থিত।
8. Seed-এ PRD অনুযায়ী ৩টি নয়, **২টি demo store** আছে।
9. Lint fail করছে; meaningful automated regression suite নেই।

**Recommendation:** এই অবস্থায় এটিকে “demo/beta review environment” হিসেবে রাখা যায়। Production launch-এর আগে অন্তত P0/P1 items resolve, integration/e2e tests যোগ, real scheduler ও payment/notification contracts সম্পূর্ণ করা উচিত।

---

## 1. Verification results

| Check | Result | Interpretation |
|---|---:|---|
| `npm run typecheck` | Pass | TypeScript compile-level error পাওয়া যায়নি |
| `npm run build` | Exit 0 / Pass | Production bundle তৈরি হয়েছে; তবে build-time DB errors log হয়েছে যখন DB available ছিল না |
| `npm run lint` | Fail | Legacy client/server code ও কিছু current route/page-এ একাধিক ESLint error |
| `npm test` | Exit 0, কিন্তু **0 tests** | এটি test pass নয়; test discovery pattern কোনো test খুঁজে পায়নি |
| `npm audit --omit=dev` | 0 vulnerability | বর্তমান production dependency audit clean |
| Git working tree | Review-এর আগে clean | Audit-এর সময় কোনো code change করা হয়নি |

### Build caveat

Build compile হয়েছে, কিন্তু static page generation-এর সময় Prisma database query error log হয়েছে। Dynamic pages হওয়ায় build exit 0 হলেও deployment pipeline-এ DB/env contract পরিষ্কার করা দরকার। Production build যেন unavailable database-কে silent warning হিসেবে না রেখে expected behavior অনুযায়ী handle করে, সেটি নিশ্চিত করা উচিত।

### Lint failure

Lint output-এ `client/`, `server/`, `src/app/demo-sms`, `src/app/super-admin/audit`, `src/app/super-admin/webhooks`, `vite.config.ts` সহ বহু error আছে। কিছু error scaffold/legacy code-এ, কিন্তু release quality gate হিসেবে `npm run check` এখন pass করছে না।

---

## 2. PRD coverage summary

### Mostly implemented

- Basic phone/password/OTP-oriented auth এবং session/refresh/logout primitives
- Tenant-aware workspace ও active store selection
- Server-side tenant/store access checks-এর বেশিরভাগ গুরুত্বপূর্ণ path
- Product/category/variant/catalog CRUD-এর core অংশ
- CSV import dry-run/commit flow
- Inventory movement ledger এবং atomic stock reservation
- Guest cart ও checkout
- Order status state machine, immutable snapshot-এর core fields, event timeline
- COD এবং bKash/Nagad/SSLCommerz adapter abstraction
- Payment callback signature/amount checks-এর basic flow
- Coupon percentage/fixed/minimum/order usage limit-এর basic implementation
- Three shipped themes: Nokshi, Bazar, Studio; draft/live config separation
- Delivery zones ও charge/free-above logic
- Staff roles/permissions/invitations-এর core flow
- In-app notification center
- Reports page এবং CSV export-এর basic version
- Subscription/entitlement/fee ledger/invoice data model-এর substantial অংশ
- Support tickets
- Super Admin overview, tenants, plans, fees, themes, tickets, webhooks, audit pages
- Seeded demo merchants, products, coupons, orders ও overage fee scenario

### Partial / incomplete

- Marketing site/reference replica
- Merchant onboarding fields ও checklist
- Subscription billing/payment method/automatic renewal
- Billing lifecycle automation
- Customer notification delivery
- Courier integration/tracking
- Customer profiles/segments/consent depth
- Payment settlement/reconciliation depth
- Reports: scheduled/asynchronous export এবং daily aggregation
- REST API coverage/OpenAPI
- Domain/TLS production integration
- SEO sitemap/robots/canonical/OG completeness
- Image upload validation/compression/storage lifecycle
- Analytics event taxonomy
- Security hardening/2FA/impersonation/rate-limit persistence
- Automated test coverage

### Clearly missing against the PRD

- Third demo store in seed
- Auth API `request-otp` ও `verify-otp`
- Billing API এবং integrations/API-key API
- Courier webhook endpoint
- Refund-request API endpoint
- OpenAPI/Swagger document
- Real background worker/scheduler for billing sweep
- Super Admin impersonation with reason/reference/time limit
- Super Admin announcements module
- Merchant payment-method connection UI with encrypted per-merchant credentials
- Real email/SMS delivery implementation
- Per-store sitemap route
- Image MIME/size validation এবং WebP/AVIF processing contract
- Full analytics event recording

---

## 3. Release blockers and correctness findings

Severity convention: **P0 = production blocker**, **P1 = high priority**, **P2 = medium**, **P3 = polish/documentation**.

### P0-1 — Test command is a false green: zero tests run

**Evidence:** `npm test` uses `node --test --experimental-strip-types "src/**/*.test.ts"` and reported `1..0`, `# tests 0`.

**Why it matters:** Payment callbacks, inventory reservation, coupon limits, order transitions, fee reversals এবং billing lifecycle-এর মতো financial/stateful code test coverage ছাড়া release করা নিরাপদ নয়। Exit code 0 হওয়ায় CI false confidence পেতে পারে।

**Fix:**

- অন্তত unit tests: money, pricing, coupon, fee base, entitlement, RBAC, order transition matrix
- integration tests: checkout reservation, duplicate idempotency, webhook, refund, invoice
- E2E: signup → onboarding → product → publish → storefront checkout → admin order
- Test discovery pattern ঠিক করে CI-তে `0 tests` হলে fail করানো

### P0-2 — Payment initiation failure-এ reservation/order/coupon cleanup নেই

**Evidence:** `src/lib/services/checkout-service.ts`-এ database transaction-এ stock reserve, order/payment create, coupon `usedCount` increment এবং cart convert করা হয়। এরপর transaction-এর বাইরে gateway `adapter.initiate()` call হয়। Initiation throw করলে compensating cancellation/release flow নেই।

Relevant flow: `checkout-service.ts` around lines 141–249 এবং 271–291.

**Failure scenario:**

1. Checkout transaction stock reserve করে এবং coupon usage count বাড়ায়।
2. Gateway API timeout/5xx দেয়।
3. Customer payment page পায় না, কিন্তু stock reserved থাকে।
4. Order pending অবস্থায় পড়ে থাকে; coupon usage permanently consumed হয়।
5. কোনো expiry worker থাকলেও বর্তমান code-এ এমন cleanup worker নেই।

**Fix:**

- Payment initiation-কে durable `INITIATED` state হিসেবে model করে retryable job/outbox ব্যবহার করুন; অথবা failure হলে atomic release/cancel করুন।
- Pending payment-এর expiry timestamp ও cleanup job যোগ করুন।
- Coupon usage reservation বনাম successful redemption আলাদা করুন; payment success/COD confirmation-এ increment করুন, অথবা idempotent rollback রাখুন।
- Gateway call যেন long DB transaction-এর পর uncontrolled orphan state না তৈরি করে।

### P0-3 — Order transition race: stale `from` status unconditional update

**Evidence:** `src/lib/services/order-service.ts` lines 223–239-এ `tx.order.update({ where: { id: orderId }, data: { status: to } })` করা হয়; `from` status-টি database update condition হিসেবে ব্যবহৃত হয় না। Caller আগে status পড়ে, কিন্তু transaction-এর মধ্যে আবার current status verify করে না।

**Failure scenario:** একই সময়ে payment webhook `PENDING_PAYMENT → PAID` এবং merchant `PENDING_PAYMENT → CANCELLED` চালালে দুই request-ই pre-check pass করতে পারে। শেষের update order status overwrite করবে, কিন্তু দুই transition-এর inventory/event side effect আলাদা আলাদাভাবে চলতে পারে। এটি reservation release, sale commit, fee reversal এবং audit timeline অসঙ্গত করতে পারে।

**Fix:**

- `UPDATE ... WHERE id = ? AND status = from` বা Prisma `updateMany` দিয়ে compare-and-swap করুন। Affected row count 0 হলে stale transition reject/reload করুন।
- Transition + payment status + inventory side effect একই transaction boundary-তে consistent করুন।
- Webhook এবং staff action-এর concurrency integration test লিখুন।

### P1-1 — Coupon usage cap concurrent checkout-এ oversubscribe হতে পারে

`validateCoupon()` প্রথমে `usedCount < usageLimit` পড়ে; পরে checkout transaction-এ unconditional `usedCount increment` করা হয়। দুই concurrent checkout একই শেষ usage দেখে দুটোই accepted হতে পারে।

**Fix:** conditional atomic increment (`usedCount < usageLimit`) এবং affected-row check; অথবা coupon redemption ledger with unique order/coupon key ব্যবহার করুন।

### P1-2 — Invoice number generation race

`billing-service.ts` lines 309–312-এ `invoice.count() + 1` দিয়ে invoice number তৈরি করা হচ্ছে। `generateInvoice()` transaction-এর ভেতরেও `nextInvoiceNumber()` global Prisma client দিয়ে count করে। Concurrent billing sweep-এ দুই transaction একই number পেতে পারে।

**Fix:** database sequence/counter table/unique retry ব্যবহার করুন। Invoice number অবশ্যই tenant/period policy অনুযায়ী unique ও concurrency-safe হতে হবে।

### P1-3 — Paid renewal manual; payment method/automatic charge বাস্তবায়িত নয়

বর্তমানে billing page-এ invoice manually “paid” করার action আছে। Paid plan-এর actual subscription payment method, saved gateway token, automatic renewal charge, payment failure response ও provider callback-এর সম্পূর্ণ flow নেই। PRD-তে payment method এবং monthly/yearly subscription lifecycle চাওয়া হয়েছে।

**Fix:** প্রথম launch-এর জন্য স্পষ্ট সিদ্ধান্ত নিন:

- manual invoice settlement MVP হিসেবে PRD-তে লিখে সীমা ঘোষণা করবেন, অথবা
- subscription payment provider/merchant billing gateway, saved payment method, charge/refund/failure webhook ও reconciliation সম্পূর্ণ করবেন।

### P1-4 — Suspended store renewal-এর পরে auto-restore হয় না

`markInvoicePaid()` subscription status `ACTIVE` করে, কিন্তু suspended store-কে `PUBLISHED` করে না। Billing sweep-এর সময় `SUSPENDED` subscription-এ store status `SUSPENDED` করা হয়। ফলে invoice paid করার পরেও storefront বন্ধ থাকতে পারে, যতক্ষণ না আলাদা restore flow চলে।

**Fix:** payment success transition-এ tenant/store status restoration policy স্পষ্টভাবে প্রয়োগ করুন; restore করার আগে store-এর আগের publish state সংরক্ষণ করুন যাতে draft store ভুল করে publish না হয়।

### P1-5 — Billing sweep automatic নয়

`runBillingSweep()`-কে code comment-এ worker/cron-এর জন্য রাখা হলেও repository-তে কোনো scheduler, cron route, queue consumer বা deployment job নেই। বর্তমানে এটি Super Admin UI button থেকে manually চালানো হয়।

**প্রভাব:** trial downgrade, renewal reminder, invoice generation, retry day 1/3/5, read-only এবং suspension production-এ সময়মতো ঘটবে না।

**Fix:** deployment target অনুযায়ী authenticated cron endpoint + secret, অথবা durable job queue/worker যোগ করুন। Job lock/idempotency রাখুন যাতে একই সময়ে দুই sweep না চলে।

### P1-6 — Customer notification requirement পূর্ণ নয়

Order status/payment code-এ notification মূলত store owner-এর in-app notification তৈরি করে। `notify()` default channel `in_app`; `sendEmail()` এবং `sendSms()` provider integration point হিসেবে log করে, বাস্তব delivery করে না। Customer-এর order confirmation SMS/email/WhatsApp flow wired নয়।

**Evidence:** `src/lib/notifications.ts` lines 44–83; `order-service.ts`-এ `notifyStoreOwner()` owner-centric।

**Fix:** customer contact-এর ভিত্তিতে confirmation/status templates, channel preference, provider adapters, retry/dead-letter এবং delivery audit যোগ করুন। WhatsApp “ready” হলে provider contract অন্তত interface + disabled state হিসেবে স্পষ্ট রাখুন।

### P1-7 — REST API coverage PRD-এর তুলনায় অনেক কম

বর্তমানে ১৩টি route আছে। Core public/catalog/order/store/webhook route থাকলেও PRD-এর auth request/verify, themes, billing, refund request, courier webhook, integrations, API keys, broader commerce এবং OpenAPI surface নেই।

**Fix:** PRD §11-এর endpoint inventory table তৈরি করে প্রতিটি route-এর status লিখুন; versioned OpenAPI schema ও generated client/contract tests যোগ করুন। `Idempotency-Key`, request-id header, plan-based rate limit এবং webhook signature contract একসাথে document করুন।

### P1-8 — Seed requirement incomplete: ৩টির বদলে ২টি demo store

`prisma/seed.ts`-এ `DEMO_STORE_SLUGS = ["nokshi-demo", "dhaka-bazar"]`; Tenant A এবং Tenant B আছে, কিন্তু PRD/DoD অনুযায়ী তিনটি polished demo store দরকার।

**Fix:** Studio theme-সহ তৃতীয় demo store, products, variants, order history, payment methods এবং storefront URL যোগ করুন। Seed output-এ expected count assertion রাখুন।

---

## 4. Business logic and data accuracy gaps

### P1-9 — Platform GMV metric cancelled/refunded order বাদ দিচ্ছে না

`platform-service.ts`-এর `platformOverview()` aggregate সব non-deleted order-এর `grandTotal` যোগ করে। `CANCELLED` এবং `REFUNDED` order আলাদা count হলেও GMV থেকে বাদ যায় না। ফলে Super Admin dashboard-এর “মোট GMV” overstated হতে পারে।

**Fix:** GMV definition PRD অনুযায়ী locked করুন—paid/confirmed eligible states, refund adjustment এবং COD policy আলাদা করে aggregate করুন।

### P1-10 — Entitlement usage order count unpaid order-ও ধরে

`entitlements.ts` lines 103–109-এ current period-এর `CANCELLED` ছাড়া সব order count হয়। এর মধ্যে `PENDING_PAYMENT`, `REFUNDED`, `RETURNED` বা অন্য non-successful state থাকতে পারে। PRD fee/overage semantics successful paid বা merchant-confirmed COD-এর উপর নির্ভর করে।

**Fix:** quota usage ও fee ordinal-এর জন্য এক canonical eligible-order predicate ব্যবহার করুন। Cancelled, fully refunded এবং unpaid pending state স্পষ্টভাবে বাদ দিন।

### P1-11 — Customer lifetime spend-এ refunded orders বাদ নেই

Customer page valid order হিসেবে শুধু `CANCELLED` বাদ দেয়; refunded order customer spend-এ থেকে যেতে পারে। Refund/return reporting-এর business definition অনুযায়ী net spend আলাদা করুন।

### P1-12 — Fee ledger eligibility/order position consistency review দরকার

Fee service-এর eligible statuses ভালোভাবে আলাদা করা হয়েছে, কিন্তু quota usage, platform GMV, customer spend এবং fee ordinal আলাদা predicates ব্যবহার করছে। একই order এক report-এ count এবং অন্য report-এ বাদ পড়লে merchant dispute তৈরি হবে। একটি shared `isSuccessfulSale()`/`eligibleForQuota()` policy ব্যবহার করুন।

---

## 5. PRD feature gaps

### Marketing website / reference replica

`src/app/(marketing)/layout.tsx`-এ navigation কেবল Feature, Pricing, Theme, Demo Store; PRD/reference-এ How it works, Learn/Help, Contact, About, Developers ইত্যাদি চাওয়া হয়েছে। Homepage-এ বর্তমান hero, feature cards এবং তিন theme-এর preview আছে, কিন্তু reference PDF-এর dashboard stat mosaic, merchant metrics, logo/social-proof tiles, testimonials, FAQ, courier story এবং complete toolkit replica নেই।

**Status:** MVP marketing page আছে; reference/PRD-complete marketing site নয়।

### Onboarding

Onboarding form-এ store name, slug, description, locale, theme এবং terms acceptance আছে। Category, logo, brand colors, business address/contact, plan/trial selection এবং visible onboarding checklist form-এ নেই। Publish readiness checklist admin settings-এ আছে, যা useful কিন্তু onboarding requirement-এর full replacement নয়।

### Themes

Nokshi, Bazar, Studio shipped এবং draft/live separation ভালোভাবে করা হয়েছে। PRD-এর initial polished three-theme MVP-এর সঙ্গে এটি মিলে যায়। তবে TODO/PRD future catalog-এ আরও themes, live responsive desktop/mobile preview, comparison, logo/favicon asset settings এবং richer content editor আছে—বর্তমান editor-এর nested collections JSON textarea-নির্ভর। এটি usable beta হলেও non-technical merchant-এর জন্য final UX নয়।

### Payments and settlement

Provider adapter interface, sandbox/live branching এবং callback amount/signature validation আছে। কিন্তু merchant-level gateway credentials encrypted at rest, transaction list/settlement status, finance reconciliation, retry/expiry UI এবং customer notification সম্পূর্ণ নয়। Current payment page global adapter status দেখায়; per-merchant connection workflow নেই।

### Delivery and courier

Delivery zones/charge/free-above implementation আছে। Courier connection, provider selection, tracking status, courier webhook এবং PRD-এর Pathao/Steadfast/RedX/Paperfly launch decision বাস্তবায়িত নয়।

### Reports

Basic sales metrics, status/provider breakdown এবং CSV link আছে। PRD-এর asynchronous CSV job, PII export permission model, daily aggregation এবং scheduled advanced reports নেই।

### Super Admin

Overview/tenant/plan/fee/theme/support/audit pages আছে। কিন্তু merchant/store search ও verification workflow, time-limited impersonation with reason/ticket reference, announcements, full refund/settlement reconciliation এবং funnel/churn/ARPU/storage/API-health metrics অনুপস্থিত বা আংশিক।

### REST API

Store, products, orders, public storefront, checkout, payment webhook এবং session utility routes আছে। Missing surface-এর কারণে external integration/mobile-app use case এখনো PRD-complete নয়। OpenAPI documentation repository-তে পাওয়া যায়নি।

### SEO and public discoverability

Store layout metadata/robots handling-এর কিছু অংশ আছে, কিন্তু actual sitemap route, per-store sitemap generation, canonical URL, Open Graph image এবং social preview completeness পাওয়া যায়নি। `proxy.ts`-এ sitemap/robots path-এর জন্য exclusion থাকলেও corresponding route থাকা প্রয়োজন।

### Upload/media hardening

Asset model/storage accounting আছে, কিন্তু PRD-এর maximum 5MB, MIME validation, WebP compression where supported, AVIF/optimization এবং malicious upload handling-এর implementation evidence নেই।

### Analytics and observability

Notification type names event taxonomy-এর মতো দেখালেও PRD-র required analytics events—signup completed, store created, first product, store published, checkout started, payment succeeded, order created, subscription started/renewed/failed, plan upgraded—এর জন্য dedicated event tracking pipeline/analytics sink নেই।

---

## 6. Security and operational review

### Positive findings

- API store creation tenant id request body থেকে নেয় না; resolved actor থেকে derive করে।
- Important service paths permission এবং store access re-check করে।
- Payment callback-এ signature এবং amount validation আছে।
- Payment webhook event-এর provider/eventKey unique idempotency model আছে।
- Password hash/session token primitives এবং OTP attempt/expiry handling আছে।
- Financial/order changes audit log-এ লেখার চেষ্টা করা হয়েছে।
- Production dependency audit clean।

### Risks to address

1. **Webhook concurrency:** existing unprocessed event check এবং processing atomic claim নয়; দুই concurrent request দুবার business side effect চালাতে পারে। Unique index row duplication ঠেকালেও side-effect race পুরোপুরি ঠেকায় না।
2. **In-memory rate limiting/cache:** multi-instance deployment-এ process-local limit consistent থাকবে না। Redis/shared store বা edge limiter দরকার।
3. **Admin/Super Admin operational security:** optional 2FA, login anomaly/suspicious activity workflow, time-limited impersonation এবং security-center metrics অনুপস্থিত।
4. **Secrets model:** provider status global env-based; per-merchant encrypted credential lifecycle এবং secret rotation UI নেই।
5. **Job idempotency:** billing/reconciliation/notification worker না থাকায় retry/deduplication contract এখনো production-grade নয়।

---

## 7. Recommended fix order

### Phase 0 — Must fix before any real merchant/payment launch

1. Add test suite and make zero-test CI failure.
2. Fix checkout failure compensation: reservation expiry/release, pending order timeout, coupon redemption semantics.
3. Make order transition compare-and-swap and add concurrency tests.
4. Make webhook processing atomically claim an event and ensure payment/order side effects are idempotent.
5. Make invoice number generation sequence-based and invoice payment state transitions guarded.
6. Add scheduler/worker for billing, pending payments, reconciliation and notification retries.
7. Decide and implement real subscription payment method/renewal model, or explicitly downgrade scope to manual billing.
8. Implement customer email/SMS confirmation or clearly gate launch to in-app-only beta.

### Phase 1 — PRD-complete beta

1. Add third demo store and seed assertions.
2. Complete auth API, refund/courier/integration/API-key routes and OpenAPI.
3. Add courier abstraction/first provider decision/tracking webhook.
4. Add Super Admin search/verification/restore/impersonation/announcements.
5. Complete SEO sitemap/canonical/OG and image upload validation/optimization.
6. Add analytics event taxonomy and operational dashboards.
7. Fix GMV/quota/customer-spend predicates with shared financial-status policy.
8. Build responsive theme live preview and less JSON-centric editor UX.

### Phase 2 — Quality and scale

1. Resolve all lint errors or isolate/remove unused legacy scaffold from the checked project.
2. Add contract tests for every API route.
3. Add load/concurrency tests for checkout, webhook and billing sweep.
4. Replace process-local rate limiting/cache with shared infrastructure.
5. Add Sentry/log correlation/request-id headers/metrics and backup-restore runbook.

---

## 8. Final answer to “সব ঠিক আছে কি?”

**না, সব এখনো ঠিক/complete নয়।** তবে project টি ফাঁকা scaffold নয়—core MVP-এর উল্লেখযোগ্য অংশ বাস্তবভাবে implemented এবং typecheck/build পর্যন্ত যায়। এটিকে আমি এইভাবে classify করব:

- **Core engineering foundation:** ভালো
- **Demo/beta readiness:** কাছাকাছি, কিছু critical bug fix দরকার
- **PRD completeness:** আনুমানিক core MVP-এর বড় অংশ আছে, কিন্তু API, billing automation, courier, notification, admin operations, SEO/media, analytics ও quality gates অসম্পূর্ণ
- **Production payment/commercial readiness:** এখনো নয়
- **Safe next step:** প্রথমে P0/P1 fixes + tests; তারপর staging-এ real gateway/scheduler/notification integration পরীক্ষা

এই report-এর মূল audit snapshot-এ কোনো code পরিবর্তন করা হয়নি; পরবর্তী phase-গুলোর implementation আলাদা commit-এ রাখা হয়েছে।

---

## 9. Post-audit Phase 1 — Financial consistency

প্রথম remediation phase-এ canonical successful-sale policy যোগ করা হয়েছে। এখন `PAID`, `CONFIRMED`, `PROCESSING`, `SHIPPED` এবং `DELIVERED` status-ই quota, fee, GMV, tenant metrics, customer lifetime spend এবং merchant revenue report-এ successful sale হিসেবে গণ্য হয়। `PENDING_PAYMENT`, `CANCELLED`, `REFUNDED`, `RETURN_REQUESTED` এবং `RETURNED` order আর এই গণনাগুলোতে ঢোকে না।

পরিবর্তিত প্রধান surface:

- `src/lib/order-status.ts` — canonical predicate ও status list
- `src/lib/entitlements.ts` — monthly order quota usage
- `src/lib/services/fee-service.ts` — fee eligibility-এর shared policy
- `src/lib/services/platform-service.ts` — platform GMV এবং tenant GMV/order metrics
- `src/lib/services/order-service.ts` — revenue, daily revenue এবং average order value
- `src/app/admin/customers/page.tsx` — customer lifetime spend
- `src/lib/order-status.test.ts` — status-policy regression coverage

Phase 1 validation: `npm run typecheck`, `npm run lint` এবং `npm test` সফল; test suite-এ ৭টি test pass করেছে। Refund adjustment, partial-refund ledger semantics এবং end-to-end database concurrency tests পরবর্তী phase-এর scope।

## 10. Post-audit Phase 2 — Seed and demo-data completeness

PRD-এর seed requirement অনুযায়ী তৃতীয় polished demo store যোগ করা হয়েছে: `studio-tech` / Studio theme। এতে চারটি category, ১০টি product, variants, coupon, sandbox payment methods, ১২টি order এবং published storefront তৈরি হয়। বিদ্যমান `nokshi-demo` ও `dhaka-bazar` data অপরিবর্তিত রেখে reset list-এ তৃতীয় slug যুক্ত করা হয়েছে।

Seed এখন explicit assertions চালায়: তিনটি store উপস্থিত, প্রতিটি published, selected theme সঠিক, এবং expected product/order count মিলে কি না। Temporary Prisma PostgreSQL-এ `npm run db:migrate` সফলভাবে সব ৪টি migration apply করেছে; `npm run db:seed` প্রথমবার এবং reset-এর পর দ্বিতীয়বারও সফল হয়েছে। দ্বিতীয় run-এ ৩টি existing demo tenant remove হয়ে পুনরায় তৈরি হয়েছে, তাই seed idempotency verified।
