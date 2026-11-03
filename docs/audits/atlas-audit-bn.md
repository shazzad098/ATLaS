# ATLaS — PRD ভিত্তিক সম্পূর্ণ অডিট রিপোর্ট

**তারিখ:** ২৩ অক্টোবর ২০২৬  
**স্কোপ:** `C:\Users\Shazzad\Downloads\ATLaS-PRD.pdf` (২৩ পৃষ্ঠা, `outputs/prd-clean.txt`-এ এক্সট্রাক্ট করা) বনাম বর্তমান কোডবেস  
**ধরন:** শুধু বিশ্লেষণ ও রিপোর্ট — কোনো কোড পরিবর্তন করা হয়নি।

---

## ০. এক নজরে

ATLaS-এর মূল কমার্স ফ্লো, অ্যাডমিন UI, থিম সিস্টেম, অর্ডার স্টেট মেশিন, ফি লেজার এবং সম্প্রতি যোগ করা **Pathao/RedX/Steadfast কুরিয়ার ইন্টিগ্রেশন** ভালোভাবে হয়েছে। কুরিয়ার আর “মিসিং” নয় — সেটি এই রিপোর্টে গ্যাপ হিসেবে ধরা হয়নি।

কিন্তু প্রোডাকশন-রেডি SaaS হিসেবে চালানোর আগে কয়েকটি **রিলিজ-ব্লকার** আছে:

- লাইভ bKash কলব্যাক যাচাই ছাড়াই অর্ডার “পেইড” করতে পারে।
- সাবস্ক্রিপশন বিলিং শিডিউলড নয়; Free প্ল্যানই একসময় SUSPENDED হয়ে যাবে।
- মার্চেন্ট নিজেই নিজের ইনভয়েস “পরিশোধিত” মার্ক করতে পারে, payment ছাড়াই Pro-তে আপগ্রেড করতে পারে, এবং বারবার ট্রায়াল চালু করতে পারে।
- Read-only/SUSPENDED অবস্থায়ও অ্যাডমিনে নতুন ডেটা লেখা বন্ধ হয় না।
- স্টোরেজ কোটা, ট্যাক্স, কাস্টমার নোটিফিকেশন, API কী, SEO, রিপোর্ট ও অবকাঠামো — বহু PRD আইটেম এখনো অসম্পূর্ণ।

### Severity সারসংক্ষেপ

| Severity | সংখ্যা | অর্থ |
|---|---:|---|
| **P0** | ৪ | লাইভ পেমেন্ট/বিলিং/টেন্যান্ট সুরক্ষার গুরুতর ত্রুটি; লঞ্চের আগে অবশ্যই ঠিক করতে হবে |
| **P1** | ১১ | PRD-এর গুরুত্বপূর্ণ ফিচার/নন-ফাংশনাল রিকোয়ারমেন্ট অসম্পূর্ণ; প্রথম রিলিজে থাকা উচিত |
| **P2** | ১৪ | পলিশ, ডকুমেন্টেশন, স্কেলিং ও পরবর্তী ইটারেশনের উন্নতি |

> **গুরুত্বপূর্ণ:** নিচের সব “প্রমাণ” কোড-লেভেল। কোনো পেনিট্রেশন টেস্ট, লোড টেস্ট বা DNS/TLS লাইভ টেস্ট করা হয়নি। তাই “নিরাপদ” বা “পারফরম্যান্স ঠিক আছে” — কোনোটি দাবি করা হচ্ছে না।

---

## ১. P0 — লঞ্চের আগে অবশ্যই ঠিক করতে হবে

### P0-1. লাইভ bKash কলব্যাক যাচাই ছাড়াই অর্ডার PAID হতে পারে

**কী হচ্ছে:** লাইভ bKash কলব্যাক হ্যান্ডলারে `paymentID` পেলেই `signatureValid: true` রিটার্ন করা হয়। এরপর `payment-service` শুধু amount মিলিয়ে দেখে — কিন্তু callback-এ amount না থাকলে সেই চেকও বাদ পড়ে যায়। ফলে `status=success&paymentID=...&merchantInvoiceNumber=...` দিয়ে একটি জাল কলব্যাক পাঠালে অর্ডার PAID হয়ে যেতে পারে, যদিও bKash-এ কোনো পেমেন্ট হয়নি।

**প্রমাণ:**
- `src/lib/payments/bkash.ts` — `parseCallback()`: `signatureValid: true`; কোনো `execute` কল নেই।
- `src/lib/services/payment-service.ts` — `handlePaymentWebhook()`: `if (callback.amount && compareMoney(...))` — amount না থাকলে চেক স্কিপ।
- `src/lib/services/payment-service.ts` — `findOrderForCallback()`: `orderNo` দিয়েও অর্ডার খোঁজে; order number customer/merchant-এর কাছে দৃশ্যমান।

**প্রভাব:** আর্থিক ক্ষতি, জাল অর্ডার সেটেলমেন্ট, ইনভেন্টরি রিলিজ, ফি লেজারে ভুল এন্ট্রি, এবং মার্চেন্টের কাছে “পেমেন্ট হয়েছে” ভুল সংকেত।

**করণীয়:**
1. লাইভ bKash-এ callback পাওয়ার পর অবশ্যই `POST /tokenized/checkout/execute` (অথবা documented verify API) কল করে `paymentID`, `amount`, `currency`, `merchantInvoiceNumber`, `status` মিলিয়ে দেখতে হবে।
2. `amount` বাধ্যতামূলক করুন; amount না থাকলে কলব্যাক reject করুন।
3. `parseCallback()`-এ `signatureValid` শুধু server-side verification-এর ফলাফল হবে — কখনোই শর্তহীন `true` নয়।
4. `orderNo` দিয়ে অর্ডার খোঁজার বদলে `payment.providerTxnId` / `payment.id` দিয়ে scoped lookup করুন।
5. একই ধরনের সমস্যা এড়াতে Nagad/SSLCommerz-এর verification পাথের জন্য contract test লিখুন।

---

### P0-2. সাবস্ক্রিপশন বিলিং লাইফসাইকল ভাঙা — Free প্ল্যানও সাসপেন্ড হবে

**কী হচ্ছে:**
- `runBillingSweep()` শুধুমাত্র Super Admin প্যানেলের একটি বাটন থেকে চলে; কোনো cron/worker/route নেই।
- Sweep-এ সব `ACTIVE` সাবস্ক্রিপশন ধরা হয়, **Free প্ল্যানও**। পিরিয়ড শেষ হলে Free-এর জন্য ০ টাকার ইনভয়েস তৈরি হয়, স্ট্যাটাস `PAST_DUE` হয়, ৭ দিন পর `READ_ONLY`, আরও ৭ দিন পর `SUSPENDED`।
- `markInvoicePaid()` সাবস্ক্রিপশন আবার `ACTIVE` করে, কিন্তু সাসপেন্ড করা `Store.status` আবার `PUBLISHED` করে না। ফলে পেমেন্ট করেও দোকান বন্ধ থাকে।
- `GRACE_PERIOD` স্ট্যাটাস বাস্তবে কখনো সেট হয় না; `PAST_DUE` থেকেই সরাসরি `READ_ONLY`-তে যায়।

**প্রমাণ:**
- `src/lib/services/billing-service.ts` — `runBillingSweep()` (প্রায় ৪৫১–৫৯৪ লাইন): কোনো `plan.code !== "free"` গার্ড নেই; ধাপ ৩-এ সব ACTIVE।
- `src/lib/services/billing-service.ts` — `generateInvoice()`: Free-এর `price = 0` হলেও ইনভয়েস তৈরি করে।
- `src/lib/services/billing-service.ts` — `markInvoicePaid()`: শুধু `Subscription` আপডেট করে, `Store.status` নয়।
- `src/app/super-admin/actions.ts` — `runBillingSweepAction`: শুধু ম্যানুয়াল বাটন।

**প্রভাব:** কিছুদিন পর প্রতিটি Free দোকান স্বয়ংক্রিয়ভাবে বন্ধ হয়ে যাবে; পেমেন্ট করেও অনেকে দোকান ফিরে পাবে না। এটি প্ল্যাটফর্মের বিশ্বাসযোগ্যতা ও রাজস্ব — দুটোই নষ্ট করে।

**করণীয়:**
1. Free প্ল্যানের জন্য sweep-এ আলাদা শাখা: নতুন পিরিয়ড সেট করুন, ইনভয়েস/PAST_DUE নয়।
2. দৈনিক scheduler যোগ করুন (cron route + external scheduler, অথবা worker)। একই sweep idempotent করুন।
3. পেমেন্ট/রিনিউ সফল হলে `Store.status` এবং প্রভাবিত সব store পুনরুদ্ধার করুন।
4. `GRACE_PERIOD` ব্যবহার করুন বা মডেল থেকে সরিয়ে দিন — দুটো রাখবেন না।
5. সাসপেন্ড/রিনিউ ফ্লো-এর জন্য integration test লিখুন: Free → ৩০ দিন → ACTIVE; paid failure → grace → read-only → suspend → renew → published।

---

### P0-3. মার্চেন্ট নিজেই বিলিং বাইপাস করতে পারে

**কী হচ্ছে:**
- `/admin/billing`-এ মার্চেন্ট নিজের OPEN invoice-এ “পরিশোধিত চিহ্নিত করুন” ক্লিক করতে পারে। `markInvoicePaid()` শুধু `tenantId` মিলিয়ে দেখে; কোনো Super Admin বা payment verification নেই।
- `changePlan()` সরাসরি `ACTIVE` করে দেয়; কোনো ইনভয়েস, payment intent বা gateway charge নেই।
- `startTrial()` বারবার চালানো যায়; “trial আগে ব্যবহার হয়েছে” এমন কোনো ফ্ল্যাগ নেই।

**প্রমাণ:**
- `src/lib/services/billing-service.ts` — `markInvoicePaid()`, `changePlan()`, `startTrial()`।
- `src/app/admin/_components/plan-switcher.tsx` — `InvoiceRowAction` / “পরিশোধিত চিহ্নিত করুন”।
- `src/app/admin/actions.ts` — `markInvoicePaidAction`, `changePlanAction` শুধু `billing:write` চেক করে।

**প্রভাব:** যে কেউ Free থেকে Pro-তে যেতে পারে, ইনভয়েস বন্ধ করতে পারে, এবং অসীম ট্রায়াল চালাতে পারে — সরাসরি রাজস্ব ক্ষতি।

**করণীয়:**
1. `markInvoicePaid` শুধু Super Admin/system payment webhook-এর জন্য রাখুন; মার্চেন্ট UI থেকে সরান।
2. `changePlan` কে “pending payment” ফ্লো-তে নিন; পেমেন্ট সফল হলে তবেই entitlements বদলান।
3. `trialUsedAt`/`trialConsumed` ফ্ল্যাগ যোগ করুন; একবারের বেশি ট্রায়াল নয়।
4. প্রোডাকশনে manual settlement রাখলে সেটি Super Admin-only + audit + reason সহ করুন।

---

### P0-4. Read-only / SUSPENDED অবস্থায়ও অ্যাডমিন লেখা বন্ধ হয় না

**কী হচ্ছে:** `assertTenantWritable()` ফাংশনটি আছে, কিন্তু কোথাও কল করা হয় না। শুধু storefront checkout এবং store publish-এ `snapshot.readOnly` চেক আছে। ফলে `READ_ONLY` বা `SUSPENDED` সাবস্ক্রিপশনেও মার্চেন্ট প্রোডাক্ট তৈরি/এডিট, স্টক অ্যাডজাস্ট, কাস্টমার/কুপন/স্টাফ পরিবর্তন করতে পারে।

**প্রমাণ:**
- `src/lib/entitlements.ts` — `assertTenantWritable()` ডিফাইন করা, কিন্তু `src/`-এ কোনো কল নেই।
- `src/lib/services/checkout-service.ts` — শুধু checkout-এ readOnly/suspended চেক।
- `src/lib/services/store-service.ts` — `publishStore()`-এ readOnly চেক।
- `src/lib/services/catalog-service.ts` — `createProduct()` ইত্যাদি শুধু permission/quota চেক করে, readOnly নয়।

**প্রভাব:** “Read-only” ও “Suspended” এনফোর্সমেন্ট কার্যত নেই; বিলিং চাপ প্রয়োগ করা যাচ্ছে না।

**করণীয়:**
1. সব mutation service-এ `assertTenantWritable(snapshot)` যোগ করুন (catalog, inventory, coupons, staff, settings, delivery, payments)।
2. middle layer হিসেবে `requireWritableWorkspace()` তৈরি করুন, যাতে ভবিষ্যতের service বাদ না পড়ে।
3. read-only-তে শুধু read/export অনুমোদিত — PRD অনুযায়ী।
4. automated test: READ_ONLY tenant → product create 402/403; checkout 403; export 200।

---

## ২. P1 — প্রথম রিলিজের আগে প্রয়োজন

### P1-1. `/admin/payments`-এ ক্রস-টেন্যান্ট ওয়েবহুক ডেটা লিক

**কী:** `listWebhookEvents(undefined, 10)` সব টেন্যান্টের `PaymentWebhookEvent` এনে দেখায়। ইভেন্ট কী-তে payment ID থাকে; এটি টেন্যান্ট আইসোলেশন ভঙ্গ করে।

**প্রমাণ:** `src/app/admin/payments/page.tsx` (২৫ লাইন), `src/lib/services/payment-service.ts` — `listWebhookEvents()`-এ tenant/store ফিল্টার নেই।

**করণীয়:** admin পেজে শুধু বর্তমান store/tenant-এর ইভেন্ট দেখান; global লিস্ট Super Admin-only রাখুন। `PaymentWebhookEvent`-এ `storeId`/`tenantId` যোগ করে query scope করুন।

**বোনাস:** `handlePaymentWebhook()`-এ invalid signature-এ `markPaymentFailure()` কল করা হয়। এটি একটি forged request দিয়ে পরিচিত pending payment FAILED করার DoS হতে পারে। ভেরিফিকেশন ব্যর্থ হলে payment status অপরিবর্তিত রাখাই নিরাপদ।

---

### P1-2. স্টোরেজ কোটা ও Asset মডেল কার্যকর নয়; আপলোড লোকাল ডিস্কে

**কী:** `assertStorageQuota()` আছে কিন্তু কোথাও কল হয় না। আপলোড রুট `public/uploads/<storeId>/`-এ ফাইল লেখে, কিন্তু `Asset` রো তৈরি করে না। ফলে `usage.storageMb` সবসময় ০-এর কাছাকাছি এবং কোটা কখনো ট্রিগার হয় না। ফাইল সংরক্ষণ প্রোডাকশন-উপযোগী অবজেক্ট স্টোরেজ নয়; serverless/কন্টেইনার রিস্টার্টে ফাইল হারিয়ে যেতে পারে।

**প্রমাণ:** `src/app/api/admin/uploads/route.ts`; `src/lib/entitlements.ts` — `assertStorageQuota()`; `prisma.asset.aggregate()` ছাড়া কোনো Asset write নেই।

**করণীয়:**
1. আপলোডে `assertStorageQuota(snapshot, fileSizeMb)` কল করুন।
2. `Asset` রো তৈরি করুন (storeId, key, size, mime, checksum)।
3. S3/R2-এর মতো অবজেক্ট স্টোরেজে আপলোড করুন; DB-তে key রাখুন।
4. ডিলিট/রিপ্লেসে quota ও orphan cleanup করুন।
5. WebP/AVIF conversion, max dimension, virus-scan hook — আলাদা ব্যাচে।

---

### P1-3. প্ল্যান এনটাইটেলমেন্টের বড় অংশ কার্যকর নয়

**কী:** ম্যাট্রিক্সে `thirdPartyCouriers`, `discountCampaigns`, `scheduledExport`, `apiAccess`, `requestsPerMinute` আছে, কিন্তু:
- Free প্ল্যানেও কুরিয়ার চালু করা যায় (`thirdPartyCouriers: false` উপেক্ষিত)।
- Basic-এ `discountCampaigns: false` হলেও কুপন তৈরি করা যায়।
- Free/Basic-এর API অ্যাক্সেস লেভেল আলাদা করা হয়নি।
- Pro-এর `scheduledExport` কোথাও নেই।
- rate limit শুধু ৩টি রুটে hardcoded (me, stores list/create); বাকি API-তে নেই।

**প্রমাণ:** `src/lib/plans.ts`; `src/lib/services/courier-service.ts` (কোনো entitlement import নেই); `src/lib/services/coupon-service.ts`; `src/lib/api.ts` — `rateLimit()`; `src/app/api/v1/**/route.ts`।

**করণীয়:**
1. কুরিয়ার কানেকশন/শিপমেন্ট তৈরির আগে `assertFeature(snapshot, "thirdPartyCouriers")`।
2. কুপন/ক্যাম্পেইন作成ে `discountCampaigns` গেট।
3. API route-এ `snapshot.features.apiAccess` ও `requestsPerMinute` প্রয়োগ করুন; rate limiter-কে plan-aware করুন।
4. `scheduledExport` হয় বানান, নয় plans থেকে সরান।

---

### P1-4. ট্যাক্স সেটিংস ও ট্যাক্স গণনা দুটোই নেই

**কী:** `StoreSettings.taxJson` ও `Order.taxTotal` স্কিমায় আছে, কিন্তু Admin Settings-এ ট্যাক্স UI নেই; checkout-এ ট্যাক্স গণনা হয় না, `taxTotal` সবসময় 0। ইনভয়েস/রিসিটেও ট্যাক্স লাইন নেই।

**প্রমাণ:** `prisma/schema.prisma` (taxJson/taxTotal); `src/lib/services/cart-service.ts` — `grandTotal = netMerchandise + shippingTotal`; `src/app/admin/settings/page.tsx` ও `_components/settings-form.tsx`-এ tax ফিল্ড নেই।

**করণীয়:** Settings-এ VAT/tax mode (inclusive/exclusive), rate, registration status যোগ করুন; cart/checkout-এ tax বের করুন; order snapshot ও invoice-এ tax লাইন রাখুন; tax report যোগ করুন।

---

### P1-5. কাস্টমার নোটিফিকেশন নেই; email/SMS অ্যাডাপ্টার স্টাব

**কী:** অর্ডার হলে শুধু মার্চেন্ট owner-এর কাছে in-app notification যায়। কাস্টমার SMS/email/WhatsApp পায় না। `sendEmail()`/`sendSms()` শুধু `console.info()` করে (OTP-এর আলাদা SMS পাথ ছাড়া)। StoreSettings-এর notification preferences UI-তে নেই, `notify()` সেগুলো পড়েও না।

**প্রমাণ:** `src/lib/services/checkout-service.ts` — শুধু `notify({ userId: store.tenant.ownerUserId, ... })`; `src/lib/notifications.ts` — ৬৮–৮৩ লাইন; `src/lib/services/store-service.ts` — `notifications` schema কিন্তু form-এ নেই।

**করণীয়:** order confirmation, payment success/failure, shipping/tracking, return — কাস্টমার চ্যানেলসহ；Resend/SES + বাংলাদেশি SMS provider বাস্তবায়ন；notification preference UI；channel-level audit।

---

### P1-6. PRD §11-এর REST API সারফেস অনেক ছোট; API key/outbound webhook/analytics নেই

**কী:** বর্তমানে `/api/v1`-এ আছে: auth, me, stores, products, orders, customers, themes, billing (GET), public storefront, payment/courier webhooks। কিন্তু PRD-তে চাওয়া হয়েছে:
- store PATCH, theme config/select/publish, domain verify
- product PATCH/import/export, inventory adjustments
- cart/items, order status/refund, coupons
- billing plans/subscriptions/change-plan/cancel/usage/invoices
- integrations connect, API keys
- outbound merchant webhooks

`WebhookDelivery` মডেল আছে কিন্তু কেউ লেখে না; API key মডেল/UI নেই; analytics event টেবিল নেই।

**প্রমাণ:** `src/app/api/v1` রুট লিস্ট; `src/lib/openapi.ts` (১৯টি path); `prisma/schema.prisma`; `src/lib/services/platform-service.ts` — `listWebhookDeliveries()` শুধু পড়ে।

**করণীয়:** API key (hashed, scoped, revocable) + outbound webhook (secret, retries, delivery log) + analytics emitter/টেবিল — একসাথে ডিজাইন করুন। তারপর OpenAPI ও `/developers` আপডেট করুন।

---

### P1-7. SEO অসম্পূর্ণ — sitemap, robots, Open Graph নেই

**কী:** store/product title/description আছে, কিন্তু per-store `sitemap.xml`, `robots.txt`, canonical, Open Graph/Twitter card, OG image generation নেই। Storefront-এর metadata-তে `openGraph` ব্লক নেই।

**প্রমাণ:** `src/app/store/[slug]/layout.tsx`, `product/[productSlug]/page.tsx`; `src/app`-এ `sitemap.ts`/`robots.ts`/`opengraph-image.tsx` নেই।

**করণীয়:** `app/store/[slug]/sitemap.ts`, `robots.ts`, dynamic OG image, canonical URL; product structured data (Product/Offer); custom domain-aware absolute URLs.

---

### P1-8. রিপোর্টিং অসম্পূর্ণ — customer report, async/scheduled export, daily aggregation নেই

**কী:** `/admin/reports`-এ sales/top products/status/payment breakdown আছে; orders CSV synchronous। Customer report, product-wise profit, scheduled export, async job, daily aggregation table নেই। CSV শুধু orders-এর।

**প্রমাণ:** `src/app/admin/reports/page.tsx`; `src/app/admin/reports/export/route.ts`; `src/lib/services/order-service.ts` — `orderMetrics()`।

**করণীয়:** customer report + product/stock report + payment reconciliation; background export job; `DailyStoreMetric` টেবিল ও দৈনিক aggregation; Pro-এর scheduled export।

---

### P1-9. প্রোডাকশন অবকাঠামো ও নিরাপত্তা প্রত্যয়ন নেই

**কী:** 
- `.github/workflows` নেই — CI/CD নেই।
- structured logging/tracing/metrics/error tracking (Sentry/OpenTelemetry) নেই; শুধু `console.*`।
- backup/restore script, RPO/RTO ডক, incident runbook নেই।
- tenant-isolation integration test নেই; মাত্র ৫টি unit test ফাইল (`dates`, `money`, `order-state`, `plans`, `slug`)।
- load/performance test নেই; storefront caching নেই (React `cache` শুধু per-request)।

**প্রমাণ:** repo root; `src/**/*.test.ts`; `src/lib/api.ts`; `package.json`।

**করণীয়:** CI (typecheck/lint/test/build), staging deploy, Sentry/OTel, DB backup drill, tenant isolation test suite, k6/artillery লোড টেস্ট — PRD NFR পূরণের জন্য।

---

### P1-10. ডোমেইন TLS ও CNAME ফ্লো আংশিক

**কী:** custom domain শুধু TXT verify করে; CNAME flow নেই। TXT সফল হলেই `tlsStatus: "ACTIVE"` সেট হয় — কোনো ACME/certificate provisioning হয় না। ফলে “TLS active” বাস্তবে SSL certificate থাকার নিশ্চয়তা দেয় না।

**প্রমাণ:** `src/lib/services/domain-service.ts` — `verifyDomain()`, `hasVerificationRecord()`; `tlsStatus: "ACTIVE"`।

**করণীয়:** CNAME/A record instructions, DNS check, real certificate provisioning (যেমন Caddy/ACME/Cloudflare SaaS), status transitions (PENDING → ISSUING → ACTIVE/FAILED), ownership re-check।

---

### P1-11. Super Admin কনসোলের গুরুত্বপূর্ণ অংশ আংশিক

**কী:**
- Theme catalog “CRUD” নেই; শুধু sync বাটন।
- Plan editor-এ শুধু products/orders/overage/storage/staff বদলানো যায়; theme pool, domain, API, reports, courier flags কোডে hardcoded।
- Platform payment gateway credentials UI নেই (env-নির্ভর)।
- Impersonation start/stop নেই; শুধু audit bucket আছে।
- “funnel, storage, API health” মেট্রিক নেই; overview-এ tenant/store/order/GMV/MRR আছে।
- Announcements নেই; শুধু support ticket।

**প্রমাণ:** `src/app/super-admin/themes/page.tsx`; `src/app/super-admin/plans/page.tsx`; `src/app/super-admin/page.tsx`; `src/app/super-admin/audit/page.tsx`।

**করণীয়:** theme version upload/publish; plan feature editor; gateway credential vault; impersonation with time-box + audit; platform health/storage panels; announcement model/UI।

---

## ৩. P2 — পলিশ, স্কেলিং ও পরবর্তী ইটারেশন

### P2-1. কাস্টমার ৩৬০°/সেগমেন্ট/কনসেন্ট/ব্ল্যাকলিস্ট UI নেই

কাস্টমার ডিরেক্টরি ও LTV আছে; detail page, saved segments (new/repeat/VIP/inactive), consent management UI, blacklist toggle নেই। `isBlacklisted` checkout-এ সম্মানিত হয়, কিন্তু UI থেকে সেট করা যায় না।

**প্রমাণ:** `src/app/admin/customers/page.tsx`; `src/lib/services/checkout-service.ts` — blacklist চেক আছে।

### P2-2. Staff invitation acceptance flow নেই

`inviteStaff()` সরাসরি user + `ACTIVE` membership তৈরি করে, `acceptedAt` সেট করে; কোনো invitation token/email/SMS/acceptance screen নেই। ভুল নম্বরে invite গেলে সেই ব্যক্তি সাথে সাথে access পায়।

**প্রমাণ:** `src/lib/services/staff-service.ts` — `inviteStaff()`।

### P2-3. অর্ডার invoice/receipt নেই

Admin order detail-এ printable invoice/receipt নেই; শুধু billing invoice (platform subscription) আছে। Customer-facing order receipt/download নেই।

**প্রমাণ:** `src/app/admin/orders/[orderId]/page.tsx`; `src/app/store/[slug]`-এ invoice route নেই।

### P2-4. মার্কেটিং: pricing yearly toggle, theme filter/preview, help search/article

- `/pricing`-এ monthly/yearly toggle নেই; `yearlyPriceBdt` DB-তে আছে কিন্তু দেখানো হয় না। TODO-তে “monthly/yearly figures” বলা হলেও বাস্তবে শুধু monthly।
- `/themes`-এ industry/style filter ও responsive preview frame নেই; শুধু gradient/swatch।
- `/help` static FAQ; article detail/search নেই।

**প্রমাণ:** `src/app/(marketing)/pricing/page.tsx`; `themes/page.tsx`; `help/page.tsx`।

### P2-5. Theme differentiation অসম্পূর্ণ

মোট ৩টি theme (Nokshi/Bazar/Studio) — PRD-এর ন্যূনতম ৩ পূরণ করে। কিন্তু Basic-এর জন্য ৫টি curated theme, Pro-exclusive theme — এসব নেই; তিনটিই সব প্ল্যানে। Basic-এ store publish-এর আগে theme switch করা যায় (PRD বলছে active subscription-এ নয়)। Plan editor থেকেও theme pool বদলানো যায় না।

**প্রমাণ:** `src/lib/theme-catalog.ts`; `src/lib/plans.ts`; `src/lib/services/theme-service.ts`।

### P2-6. Settings-এর কিছু ফিল্ড dead / UI-তে নেই

`minOrderTotal`, `requirePhoneVerification`, `notifications` স্কিমায় আছে কিন্তু checkout/UI-তে ব্যবহৃত হয় না। Tax ও API key placeholder-ও Settings-এ নেই (TODO-তে থাকলেও)।

**প্রমাণ:** `src/lib/services/store-service.ts` — settings schema; `src/app/admin/_components/settings-form.tsx`।

### P2-7. Account deletion-এর purge job নেই

ডিলিট request ও cancel হয়, কিন্তু ৩০ দিন পর ডেটা মুছে ফেলার কোনো worker/script নেই; “operator purge” ম্যানুয়াল।

**প্রমাণ:** `src/lib/services/account-service.ts` — `requestAccountDeletion()`।

### P2-8. ইমেজ পাইপলাইন অনুপস্থিত

WebP/AVIF conversion, resize, checksum, virus scan, CDN invalidation নেই; original file যেমন আসে তেমন 저장 হয়। ৫MB cap ও MIME whitelist আছে — ভালো।

**প্রমাণ:** `src/app/api/admin/uploads/route.ts`।

### P2-9. পারফরম্যান্স/সার্চ/ক্যাশিং যাচাই হয়নি

Storefront প্রতিটি request-এ DB hit করে; কোনো ISR/`unstable_cache`/HTTP cache নেই। Search `ILIKE`-ভিত্তিক, PostgreSQL full-text index নেই। p95 <500ms/admin <800ms NFR-এর কোনো প্রমাণ নেই।

**প্রমাণ:** `src/lib/services/catalog-service.ts`; `src/lib/storefront.ts`; `src/app/store/[slug]/**`।

### P2-10. অ্যাডমিন পেমেন্ট স্ক্রিন আংশিক

শুধু provider enable/disable; transaction list, fee breakdown, gateway credential connect, refund history নেই। `encryptedSecretRef` ফিল্ড আছে কিন্তু কোথাও লেখা/এনক্রিপ্ট করা হয় না। TODO-র “gateway connect (secrets encrypted)” বাস্তব নয়।

**প্রমাণ:** `src/app/admin/payments/page.tsx`; `src/lib/services/store-service.ts` — `togglePaymentMethod()`।

### P2-11. অনবোর্ডিং-এ plan/trial choice নেই

Signup-এ plan choice নেই; নতুন tenant সবসময় Free-এ যায়। Onboarding-এ শুধু store name/slug/theme/locale। PRD-এর “plan choice + 7-day trial” অনবোর্ডিং ফ্লোতে নেই।

**প্রমাণ:** `src/app/onboarding/page.tsx`; `src/lib/services/account-service.ts` — `provisionAccount()`।

### P2-12. ইংরেজি UI toggle নেই

`locale` ফিল্ড (bn/en) আছে, কিন্তু সব copy হার্ডকোডেড বাংলা; কোনো dictionary/i18n runtime নেই। PRD DoD-তে BN/EN rendering চাওয়া হয়েছে। (আপনার মূল requirement বাংলা UI হওয়ায় এটি P2।)

**প্রমাণ:** `src/app/store/[slug]/layout.tsx`; `src/app/admin/settings/page.tsx`; `src/lib/theme-catalog.ts`।

### P2-13. ছোট ডেটা/মডেল অসঙ্গতি

- `GRACE_PERIOD` enum ব্যবহৃত হয় না; UI-তে `GRACE` লেবেল।
- `nextInvoiceNumber()` = `count + 1`; concurrent invoice-এ collision সম্ভব।
- Order number per-store unique, কিন্তু payment callback-এ global `findFirst` — তাত্ত্বিকভাবে ভুল store-এ match হতে পারে।
- `Store.status` SUSPENDED হলে renewal-এ auto-restore নেই (P0-2-এর অংশ)।

### P2-14. ডকুমেন্টেশন ও TODO অতিরঞ্জিত

`TODO.md`-তে কয়েকটি `[x]` বাস্তবের চেয়ে বেশি:

| TODO দাবি | বাস্তবতা |
|---|---|
| “daily sweep” | শুধু Super Admin বাটন; cron নেই |
| “payment method screen, monthly/yearly” | payment method নেই; yearly toggle নেই |
| “Settings: tax, notifications, API keys placeholder” | তিনটিই UI-তে নেই |
| “gateway connect (secrets encrypted)” | শুধু enable/disable; encryption নেই |
| “seven themes” | ৩টি theme |
| “theme catalog CRUD” | শুধু sync |
| “funnel, storage, API health” | overview মেট্রিকে নেই |
| “per-plan request-rate limits” | hardcoded; মাত্র ৩ রুটে |
| “success/announcements” | announcements নেই |
| “failed signature leaves payment pending” | বাস্তবে payment FAILED করে |

---

## ৪. যা ভালোভাবে হয়েছে (অস্বীকার নয়)

- **কুরিয়ার:** Pathao/RedX/Steadfast adapter registry, sandbox-first mode, Store ID per merchant, signed webhook, idempotency, order status bridge, 0.5% fee — সবই আছে এবং যাচাই করা হয়েছে।
- **অর্ডার স্টেট মেশিন:** ১০টি স্ট্যাটাস, transition guard, immutable line snapshot, inventory reservation/restock, fee reversal।
- **টাকা:** Decimal/paise ভিত্তিক গণনা, BDT ফরম্যাটিং।
- **টেন্যান্ট স্কোপিং:** বেশিরভাগ service-এ `assertStoreAccess()` ও tenant-derived actor; শুধু payments webhook list ব্যতিক্রম।
- **থিম সিস্টেম:** ৩টি theme, shared section kit, draft/publish, config validation, Basic lock।
- **অ্যাডমিন UX:** dark mode (admin-only), responsive nav/drawer, Bengali UI, empty states, audit log।
- **পেমেন্ট অ্যাডাপ্টার:** bKash/Nagad/SSLCommerz/COD interface; SSLCommerz/Nagad-এ server-side validation আছে (bKash-এ নেই)।
- **ডকুমেন্টেশন:** README/TODO/OpenAPI তুলনামূলক ভালো; তবে উপরের overstatement গুলো ঠিক করা দরকার।

---

## ৫. প্রস্তাবিত বাস্তবায়ন ক্রম

### ব্যাচ A — P0 (জরুরি, আনুমানিক ২–৪ দিন)
1. bKash execute/verify + amount বাধ্যতামূলক + forged callback বন্ধ।
2. Admin payments webhook list tenant-scoped।
3. Billing sweep: Free-প্ল্যান গার্ড, daily scheduler, renewal-এ store restore।
4. Merchant self-mark-paid/self-upgrade/unlimited trial বন্ধ।
5. সব mutation-এ read-only enforcement।

### ব্যাচ B — P1 (প্রথম রিলিজ, আনুমানিক ১–২ সপ্তাহ)
1. Storage quota + Asset + S3/R2।
2. Plan entitlement enforcement (courier, coupons, API rate)।
3. Tax settings + checkout/invoice tax।
4. Customer notification channels (SMS/email) + preferences।
5. API keys + outbound webhooks + analytics event table।
6. SEO (sitemap/robots/OG)।
7. Reports (customer/export/scheduled/aggregation)।
8. CI, observability, backup drill, tenant-isolation tests।
9. Domain TLS/CNAME provisioning।
10. Super Admin gaps (theme CRUD, plan features, impersonation, gateway credentials)।

### ব্যাচ C — P2 (পরে)
Customer 360/segments/consent, staff invite acceptance, order invoice, marketing filters/yearly toggle/help search, theme differentiation, settings dead fields, account purge, image pipeline, performance/search, i18n toggle, doc cleanup।

---

## ৬. সিদ্ধান্ত প্রয়োজন

আমি এখনো কোনো কোড পরিবর্তন করিনি। আপনি বলুন কোন ব্যাচ বা কোন конкретные আইটেম আগে করব:

- **A:** P0 নিরাপত্তা ও বিলিং (সবচেয়ে জরুরি)
- **B:** P1 রিলিজ-ব্লকার (স্টোরেজ, ট্যাক্স, নোটিফিকেশন, API, SEO, ops)
- **C:** P2 পলিশ
- অথবা নির্দিষ্ট আইটেম, যেমন: “আগে bKash + billing + read-only ঠিক করো”।

আমার সুপারিশ: **A সম্পূর্ণ → B-এর ১–৪ → B-এর ৫–১০**।
