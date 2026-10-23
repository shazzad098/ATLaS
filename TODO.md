# ATLaS — TODO (outcome items)

Status: [ ] open · [x] delivered with evidence

## 1. Marketing website (PRD 4.1 + reference replica)
- [ ] Homepage replicates the reference screenshot: sticky header (logo, Home, Pricing, Templates, How it works, Learn, Contact, About Us, Log In outline, Create Your Store blue), "No.1 Online business partner" pill, "One Platform / Thousands of Success Stories" hero, Start for Free CTA + "(No credit card needed. No hidden fees.)", dashboard stat mosaic (Merchant Orders bar chart with Today/This Week, Today's Merchant Sell donut, Online Payment vs COD, Weekly Merchant Sales line, Total Order Amount gauge, New Shop, Active Shop, 100K+/3M+ with avatars), "100,000+ Stores Built — Yours Could Be Next" logo tiles, "Your Complete Ecommerce Toolkit" 6 feature cards, teal "Explore the Full Demo" banner, "Simple Steps to Make Your Website Live" 3 steps, "How we transformed their journey" testimonials.
- [ ] Homepage also covers PRD items: value proposition, demo store previews, feature overview, Bangladesh payment/courier story (bKash, Nagad, SSLCommerz, COD; Pathao, Steadfast, RedX, Paperfly), testimonials, CTA, FAQ, footer.
- [ ] Template Catalog: category, industry, style, plan availability filters, live preview, responsive (desktop/tablet/mobile) preview, theme comparison.
- [ ] Pricing: monthly/yearly toggle, quota, transaction fee, feature comparison, FAQ — data from plans table.
- [ ] How it works: create account → create store → choose theme → add products → connect payment → start selling.
- [ ] Help center, Terms, Privacy, Refund/Cancellation Policy, Contact/Support (creates support ticket), About, Developers (REST API docs).

## 2. Authentication & account (FR-01, §13)
- [ ] Email/phone signup; Bangladesh mobile number verification by OTP; email/password or passwordless (OTP) login.
- [ ] Session management, refresh token rotation, logout all sessions; sessions list with ip/user agent.
- [ ] Optional 2FA (TOTP) for Super Admin and Pro merchant.
- [ ] Account deletion request with retention policy.
- [ ] Password never plaintext (bcrypt); OTP brute-force protection, device/IP rate limit; CSRF protection for cookie session; login events recorded.

## 3. Merchant onboarding & multi-tenancy (4.2, FR-02, US-01)
- [ ] Business/store name, category, logo, brand colors, address, contact number.
- [ ] Unique subdomain selection `store-slug.atlas.example`: valid slug availability realtime দেখা যায়; duplicate slug reject হয়।
- [ ] Trial activation এবং plan selection; store created হলে default theme ও onboarding checklist তৈরি হয়; Free entitlement automatically assigned হয়।
- [ ] Onboarding checklist: add first product, configure delivery, choose payment, publish store.
- [ ] প্রতিটি Store একটি logical tenant boundary; সব business table-এ tenant/store id mandatory এবং server-side scope enforce; tenant_id server-side derive, client payload trust না।
- [ ] এক user-এর একাধিক store থাকলে workspace switcher।

## 4. Subscription, entitlements & fee ledger (§5, US-02, US-03, US-06)
- [ ] Four plans Free/Basic/Standard/Pro with matrix: products 25/250/1,000/Unlimited; monthly orders included 50/500/2,000/Unlimited; overage 2.5%/2%/1%/0%; storage 100MB/1GB/5GB/Unlimited fair-use; themes 2 starter/5 curated/all standard/all + Pro-exclusive; theme switching starter-limited/not allowed during active subscription/allowed/allowed; custom domain No/No/Yes/Yes; Pro custom domain + subdomain together; staff seats 1/2/5/10; coupons basic/basic/advanced/advanced; reports basic/CSV export/advanced/advanced+scheduled; courier manual/third-party 0.5%/more/all; API read-only public/API+webhooks/full scoped/full+higher rate limit; support community/standard/priority/priority+onboarding; yearly billing; 7-day trial no card.
- [ ] Entitlement checked on backend per request (tenant, plan, feature_key, usage metric, limit); snapshot cache invalidated on billing change; frontend hides + backend enforces.
- [ ] US-02: Free merchant 25-এর পর create/import blocked with clear upgrade message; existing products read/edit করা যায়; plan upgrade হলে quota immediately increase হয়।
- [ ] US-03: included quota এবং consumed quota dashboard-এ visible; eligible order-এর জন্য fee ledger তৈরি হয়; cancelled/fully refunded order reverse/void হয়; invoice-এ order reference ও fee rate দেখায়।
- [ ] Fee semantics: "per sale" = paid or merchant-confirmed COD; gateway fees separate; third-party courier 0.5% separate fee type (no double count); base = discount-adjusted merchandise subtotal excluding delivery and refunded lines.
- [ ] Lifecycle TRIALING → ACTIVE → PAST_DUE → GRACE_PERIOD → READ_ONLY → SUSPENDED → CANCELLED; trial end without paid plan → Free downgrade; payment failure → 7-day grace (store live + owner alert); read-only keeps data export & billing renewal open; suspension shows storefront maintenance page with data retained; downgrade never deletes data, quota exceed blocks new create with upgrade prompt.
- [ ] US-06: renewal reminder 7, 3, 1 day আগে; failed payment-এ grace period badge; suspension-এ maintenance state এবং data export available; failed payment retry day 1/3/5.
- [ ] Subscription & Billing module: plan, usage, invoices, payment method, upgrade/downgrade, monthly/yearly.

## 5. Storefront (4.3, Appendix A)
- [ ] Mobile-first responsive storefront: Home, shop/category, product details, cart, checkout, order success, contact/about, policy pages.
- [ ] Theme-driven predefined sections on one contract: Header, Hero, CategoryGrid, ProductGrid, PromoBanner, Testimonials, TrustBar, Footer; themes Nokshi (fashion, warm, large imagery), Bazar (grocery, dense, category-first), Studio (gadgets/cosmetics, whitespace, strong search) + Kantha, Dokan, Rong, Prestige (Pro-exclusive).
- [ ] Theme settings: logo, favicon, colors, fonts, button style, header/footer, banners, navigation, homepage blocks.
- [ ] Product search, category filter, sorting, pagination; variants (size, color, material, SKU, price override, stock); coupon/discount support.
- [ ] COD এবং online payment (bKash/Nagad/SSLCommerz) checkout; guest checkout, optional customer account (phone lookup for order tracking).
- [ ] Order confirmation by SMS/email/WhatsApp-ready notification adapter.
- [ ] Basic SEO: title, description, slug, Open Graph image, sitemap per store.
- [ ] Bengali/English content support and UI label toggle.

## 6. Merchant admin (4.4)
- [ ] Overview: revenue, orders, pending actions, low stock, subscription usage, onboarding checklist, announcements.
- [ ] Products: create/edit/archive, bulk import (CSV validation + dry-run)/export, categories, tags, variants, inventory; SKU, price, compare-at-price, stock, low-stock threshold, images, SEO metadata.
- [ ] Inventory adjustment ledger (reason সহ, direct overwrite নয়); atomic stock reservation during checkout.
- [ ] Orders: states PENDING_PAYMENT, PAID, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED, REFUNDED, RETURN_REQUESTED, RETURNED; status timeline, payment status, fulfillment, notes, invoice, refund request; immutable snapshot (product name, price, discount, shipping, tax, customer address); actor + timestamp audit.
- [ ] Customers: profiles, order history, segments, blacklist, consent.
- [ ] Discounts: coupon, percentage/fixed, minimum cart, date range, usage cap (advanced campaigns on Standard/Pro).
- [ ] Store Design: theme selection, theme settings, homepage sections, navigation, preview/publish; US-04 desktop/mobile preview, draft save, live storefront unchanged until publish, Basic plan selected theme locked state; theme switch compatibility check; config validated by JSON schema; publish atomic.
- [ ] Payments: gateway connection (secrets encrypted at rest), transaction list, settlement status, fee breakdown.
- [ ] Delivery: zones, delivery charge, courier connection, tracking status.
- [ ] Reports: sales, products, customers, order status, payment method, export (async CSV job, PII export permission-controlled, daily aggregation).
- [ ] Staff & Roles: plan-dependent seats and permissions, invitations.
- [ ] Settings: business profile, domain (subdomain auto, custom domain TXT/CNAME verification, statuses pending/verified/active/failed/suspended, TLS status), tax settings, policies, notifications, API keys + webhooks.
- [ ] In-app notification center; events: order created, payment received, low stock, subscription renewal/failure, domain verified; email adapter + SMS provider-ready interface.
- [ ] Support tickets from merchant side.

## 7. Payments (FR-05, US-05)
- [ ] bKash, Nagad, SSLCommerz adapter interface + COD first-class.
- [ ] Payment initiation-এ unique transaction reference; callback/webhook verification; duplicate callback order double-paid করে না; signature/verification failure হলে payment pending/failed হয়; merchant এবং customer notification পায়।
- [ ] Idempotency (provider, event_key) unique; failed/pending/expired payment retry; reconciliation report.

## 8. Super Admin console (4.5)
- [ ] Merchant/store search, verification, suspend/restore, impersonation with audit log (reason, ticket/reference, start/end, time-limited).
- [ ] Plan and entitlement configuration.
- [ ] Theme/template CRUD, preview and rollout.
- [ ] Payment gateway credentials and webhook monitoring.
- [ ] Subscription, invoice, fee, refund and settlement reconciliation.
- [ ] Support tickets and announcements.
- [ ] Platform metrics: active stores, MRR, ARR, ARPU, churn, GMV, ATLaS fee revenue, conversion funnel, storage, API health.
- [ ] Security center: login events, suspicious activity, rate limits, audit logs.

## 9. REST API & integrations (§11)
- [ ] `/api/v1` endpoints: auth (request-otp, verify-otp, refresh, logout, me), stores & themes, catalog, commerce, billing, webhooks (payments/couriers), integrations connect, api-keys.
- [ ] OpenAPI documentation, cursor pagination, request id, Idempotency-Key on checkout/payment, consistent error envelope, rate limits by plan, webhook signature verification.
- [x] Auth REST subset: request-otp এবং verify-otp with session creation, signup provisioning, password reset, rate limiting and stable errors.
- [x] Return/refund REST subset: return request এবং tenant/order-bound approval/resolution endpoints with duplicate/state guards.

## 10. Platform policies & quality
- [ ] Bangla and English labels; BDT currency; Asia/Dhaka timezone.
- [ ] Analytics event taxonomy: signup_completed, store_created, theme_selected, first_product_created, store_published, checkout_started, payment_succeeded, order_created, subscription_started, subscription_renewed, subscription_failed, plan_upgraded.
- [ ] Appendix B defaults: trial 7 days no card; grace 7 days; retry day 1/3/5; product image max 5MB, WebP compression where supported; API rate limit 60 req/min per user with plan upgrade; soft delete products; financial records immutable.
- [ ] Upload MIME validation, image size limit; audit logs for admin actions.
- [x] Seed: Super Admin, demo merchant, 3 polished demo stores with products/orders; deterministic count/theme assertions are enforced.
- [ ] Validation agent pass over implementation vs this list.
