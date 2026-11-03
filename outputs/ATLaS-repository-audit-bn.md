# ATLaS repository audit — `main` branch

**Audit target:** [`shazzad098/ATLaS`](https://github.com/shazzad098/ATLaS), commit [`5296e77bcaef67245b10579fb79b42fed48c3458`](https://github.com/shazzad098/ATLaS/commit/5296e77bcaef67245b10579fb79b42fed48c3458)  
**Audit date:** 30 October 2026  
**Result:** 19 confirmed findings: **11 High, 7 Medium, 1 Low**. Severity is based on source-level impact; no live deployment or provider credential was tested.

## সবচেয়ে জরুরি বিষয়

1. `next.config.ts` যদি build-এর সময় `.env.local` পায়, সেটির সব key Next.js-এর `env` option-এ ঢোকায়। এতে file-এ থাকা server secret browser bundle-এ embed হতে পারে। এটি conditional risk—Docker build-এ `.env.*` বাদ আছে, কিন্তু অন্য build context-এ `.env.local` থাকলে ঝুঁকি তৈরি হয়।
2. Seed script-এ public repository-তে থাকা স্থির super-admin password দিয়ে account তৈরি/আপডেট হয়। production database-এ seed চালানো হলে credential compromise ধরে নিয়ে তাৎক্ষণিকভাবে password ও সংশ্লিষ্ট secrets rotate করা উচিত।
3. SMS configuration-এ source code-এর hard-coded API-key fallback আছে। এটি বাস্তব/সক্রিয় provider credential কি না যাচাই করা হয়নি; provider-এর সঙ্গে মিলিয়ে credential revoke/rotate করা দরকার।
4. Public order-tracking page-এ order number একাই যথেষ্ট হতে পারে customer phone, address, item ও payment তথ্য দেখানোর জন্য।
5. সর্বশেষ GitHub Actions run (`5296e77`) failed: Web job `npm test`-এ, API job `npm --prefix api ci`-তে ব্যর্থ হয়েছে। API install step-এর পরের typecheck, lint, test ও build ওই run-এ হয়নি।

## Findings

### High

#### 1. `.env.local`-এর সব key browser bundle-এ embed হওয়ার ঝুঁকি

[`next.config.ts`](https://github.com/shazzad098/ATLaS/blob/5296e77bcaef67245b10579fb79b42fed48c3458/next.config.ts#L1-L33)-এর `loadLocalEnv()` `.env.local` পড়ার পর সম্পূর্ণ object-টি Next.js-এর `env` option-এ ছড়িয়ে দেয়। ওই file-এ `DATABASE_URL`, `AUTH_SECRET`, payment/storage credentials বা অন্য server-only secret থাকলে build-এর client code-এ সেগুলো embed হতে পারে।

**শর্ত ও প্রভাব:** `.env.local` build context-এ না থাকলে এই নির্দিষ্ট code path কিছু expose করে না; Docker-এর [`.dockerignore`](https://github.com/shazzad098/ATLaS/blob/5296e77bcaef67245b10579fb79b42fed48c3458/.dockerignore#L1-L17) `.env.*` বাদ দেয়। কিন্তু non-Docker build বা ভুলভাবে অন্তর্ভুক্ত করা local file-এ secret থাকলে এটি গুরুতর disclosure।

**সংশোধন:** `env: { ...localEnv }` সরিয়ে দিন। browser-এ প্রয়োজনীয় হলে কেবল স্পষ্টভাবে অনুমোদিত `NEXT_PUBLIC_*` key allow-list করুন। যদি কোনো deployed build-এ secret-সহ `.env.local` ব্যবহৃত হয়ে থাকে, সেই secret rotate করুন।

#### 2. Seed script স্থির public super-admin password ব্যবহার করে

[`prisma/seed.ts`](https://github.com/shazzad098/ATLaS/blob/5296e77bcaef67245b10579fb79b42fed48c3458/prisma/seed.ts#L30-L40) ও [seed-এর super-admin upsert/entry-point](https://github.com/shazzad098/ATLaS/blob/5296e77bcaef67245b10579fb79b42fed48c3458/prisma/seed.ts#L88-L111) স্থির password hash করে super-admin account create/update করে; seed সেটি log-ও করে। Demo fixture বন্ধ থাকলেও super-admin seed হয়।

**প্রভাব:** production database-এ seed চালালে public source থেকে জানা credential-সহ platform-wide admin account পাওয়া যেতে পারে; seed পুনরায় চালালে password আবার সেই মানে ফিরতে পারে।

**সংশোধন:** source-এর password এবং log সরিয়ে দিন। production-এ seed fail-closed করুন; প্রয়োজন হলে random one-time credential secret manager/out-of-band মাধ্যমে দিন এবং প্রথম login-এ password বদল বাধ্যতামূলক করুন। যদি seed ইতিমধ্যে production-এ চালানো হয়ে থাকে, super-admin password ও সংশ্লিষ্ট secret rotate করে session revoke করুন।

#### 3. SMS API key-এর hard-coded fallback

[`src/lib/env.ts`](https://github.com/shazzad098/ATLaS/blob/5296e77bcaef67245b10579fb79b42fed48c3458/src/lib/env.ts#L50-L74)-এ `SMS_API_KEY` না থাকলে বা নির্দিষ্ট prefix থাকলে source-এ লেখা fallback key ফেরত আসে। Provider-ও default করা আছে; ফলে `configured` true হতে পারে এবং production guard-কে SMS credentials নেই—এ কথা বোঝাতে বাধা দেয়। Key-টি এখানে পুনরায় প্রকাশ করা হয়নি এবং provider-এ পরীক্ষা করা হয়নি।

**প্রভাব:** key সক্রিয় হলে public repository-তে প্রকাশিত credential দিয়ে provider account অপব্যবহার/খরচ বাড়ানোর ঝুঁকি আছে। Missing production SMS configuration fail-closed না-ও হতে পারে।

**সংশোধন:** provider-এর কাছে key-টির অবস্থা যাচাই করে সক্রিয় হলে অবিলম্বে revoke/rotate করুন। Source fallback মুছে দিন; `configured` কেবল operator-এর স্পষ্টভাবে দেওয়া key ও provider config থাকলেই true হোক।

#### 4. BulkSMSBD path-এ API key এবং OTP plaintext HTTP-তে পাঠানো হয়

[`src/lib/auth/otp.ts`](https://github.com/shazzad098/ATLaS/blob/5296e77bcaef67245b10579fb79b42fed48c3458/src/lib/auth/otp.ts#L228-L240)-এর `bulksmsbd` branch `http://` endpoint ব্যবহার করে এবং request body-তে API key ও OTP পাঠায়।

**শর্ত ও প্রভাব:** এই ঝুঁকি তখনই ঘটবে যখন deployment-এ ওই provider branch সক্রিয় করা হবে। সে ক্ষেত্রে network path-এ traffic দেখা/পরিবর্তন করতে পারা কেউ credential ও OTP পেতে পারে।

**সংশোধন:** production-এ HTTPS ছাড়া SMS provider endpoint গ্রহণ করবেন না; non-TLS provider configuration startup-এ reject করুন।

#### 5. Tenant member-দের billing action-এ RBAC check নেই

[`src/app/api/v1/billing/route.ts`](https://github.com/shazzad098/ATLaS/blob/5296e77bcaef67245b10579fb79b42fed48c3458/src/app/api/v1/billing/route.ts#L23-L52) tenant membership resolve করার পর GET-এ `billing:read` এবং POST-এ `billing:write` যাচাই করে না। সরাসরি ডাকা [billing service](https://github.com/shazzad098/ATLaS/blob/5296e77bcaef67245b10579fb79b42fed48c3458/src/lib/services/billing-service.ts#L146-L255)-ও ওই permission enforce করে না।

**প্রভাব:** billing permission-বিহীন active tenant member subscription/fee তথ্য পড়তে পারে এবং plan পরিবর্তন, trial শুরু বা subscription cancel করার চেষ্টা করতে পারে।

**সংশোধন:** route-এ যথাক্রমে `billing:read`/`billing:write` enforce করুন; service-এও defense-in-depth যোগ করুন। Role-ভিত্তিক 403 tests লিখুন।

#### 6. Payment settlement amount ছাড়াই সফল হতে পারে; Nagad order/amount binding দুর্বল

[`payment-service.ts`](https://github.com/shazzad098/ATLaS/blob/5296e77bcaef67245b10579fb79b42fed48c3458/src/lib/services/payment-service.ts#L100-L116)-এ callback amount থাকলেই কেবল amount match যাচাই হয়। `amount` অনুপস্থিত হলেও callback সফল হিসেবে settle হতে পারে। [Nagad verification path](https://github.com/shazzad098/ATLaS/blob/5296e77bcaef67245b10579fb79b42fed48c3458/src/lib/payments/nagad.ts#L105-L121) status যাচাই করে, কিন্তু gateway-verified paid amount এবং merchant order/reference local order-এর সঙ্গে মিলিয়ে নিশ্চিত করে না।

**প্রভাব:** incomplete বা ভুলভাবে bound callback-এ order paid হয়ে যেতে পারে, যদিও প্রত্যাশিত অর্থ আদায়ের প্রমাণ নেই।

**সংশোধন:** প্রতিটি সফল callback-এ non-null, parseable amount বাধ্যতামূলক করে order total-এর সঙ্গে তুলনা করুন। Nagad-এর server-side verification response থেকে amount ও order/reference মিলিয়ে তারপর settle করুন। Missing amount, wrong amount, wrong order-এর tests যোগ করুন।

#### 7. Refund amount-এর সীমা ও idempotency enforce হয় না

[`refundOrder`](https://github.com/shazzad098/ATLaS/blob/5296e77bcaef67245b10579fb79b42fed48c3458/src/lib/services/payment-service.ts#L418-L482)-এ requested amount positive কি না, captured amount-এর বেশি কি না, আগের refund বাদে অবশিষ্ট কত—এসব যাচাই নেই। একই request পুনরায় এলে একাধিক gateway refund ও ledger row তৈরি হতে পারে।

**প্রভাব:** privileged caller/buggy integration থেকে over-refund এবং gateway, payment, order, fee ledger-এর অমিল হতে পারে।

**সংশোধন:** transaction/row lock-এর মধ্যে `0 < amount <= captured - successful refunds` enforce করুন; refund idempotency key ও provider reference persist করুন এবং gateway result যাচাই করে ledger/status update করুন।

#### 8. Custom domain দিয়ে storefront checkout সম্পন্ন হয় না

[`proxy.ts`](https://github.com/shazzad098/ATLaS/blob/5296e77bcaef67245b10579fb79b42fed48c3458/src/proxy.ts#L68-L95) custom domain-কে synthetic `/store/_host` route-এ rewrite করে। Checkout action সেই `_host`-কে store slug হিসেবে [`placeOrder`](https://github.com/shazzad098/ATLaS/blob/5296e77bcaef67245b10579fb79b42fed48c3458/src/lib/services/checkout-service.ts#L75-L86)-এ পাঠায়; service slug দিয়েই store খোঁজে। `_host` নামে store না থাকায় order create হওয়ার আগেই NotFound হয়।

**প্রভাব:** verified custom-domain storefront-এ customer checkout করতে পারে না; মূল platform slug দিয়ে একই store ব্যবহার করলে path আলাদা হতে পারে।

**সংশোধন:** trusted host resolution থেকে পাওয়া store ID/context action-এ পাঠান এবং `placeOrder`-কে slug-only lookup-এর বদলে resolved store ID নিন। Custom-host rewrite থেকে successful order পর্যন্ত integration test যোগ করুন।

#### 9. Public order page authentication ছাড়া customer PII দেখাতে পারে

[Order page](https://github.com/shazzad098/ATLaS/blob/5296e77bcaef67245b10579fb79b42fed48c3458/src/app/store/%5Bslug%5D/order/%5BorderNo%5D/page.tsx#L31-L137)-এ phone query optional। [`findPublicOrder`](https://github.com/shazzad098/ATLaS/blob/5296e77bcaef67245b10579fb79b42fed48c3458/src/lib/services/order-service.ts#L281-L296) phone না থাকলে `storeId + orderNo` দিয়েই order ফেরত দেয়; পেজে customer name, phone, পূর্ণ ঠিকানা, items, payment ও timeline render হয়। Order number-এর entropy-ও সীমিত: [date + six-digit random suffix](https://github.com/shazzad098/ATLaS/blob/5296e77bcaef67245b10579fb79b42fed48c3458/src/lib/dates.ts#L39-L45)।

**প্রভাব:** order number পাওয়া বা enumerate করতে পারা কেউ customer contact/address ও purchase history দেখতে পারে। Live exploitability deploy-এ rate limiting/extra proxy controls আছে কি না তার ওপরও নির্ভর করে; source path-এ mandatory proof-of-possession নেই।

**সংশোধন:** random high-entropy tracking token বা authenticated/phone-verified confirmation বাধ্যতামূলক করুন; PII-bearing order details শুধু order number-এ দেখাবেন না। Guessing rate-limit ও missing/wrong token tests যোগ করুন।

#### 10. Account action অন্য user-এর session ID revoke করতে পারে

[`revokeSessionAction`](https://github.com/shazzad098/ATLaS/blob/5296e77bcaef67245b10579fb79b42fed48c3458/src/app/account/actions.ts#L59-L74) form থেকে session ID নেয়; [`revokeSession`](https://github.com/shazzad098/ATLaS/blob/5296e77bcaef67245b10579fb79b42fed48c3458/src/lib/auth/session.ts#L183-L188) update predicate-এ session ID ছাড়া user ID চায় না।

**প্রভাব:** অন্যের session ID জানা কোনো authenticated user সেটি revoke করতে পারে। এটি account boundary check না থাকার সমস্যা; session ID অনুমানযোগ্য—এমন দাবি নয়।

**সংশোধন:** authenticated current user ID service-এ পাঠিয়ে `where: { id, userId, revokedAt: null }` enforce করুন; cross-user revoke 403/404 test যোগ করুন।

#### 11. API CI `npm ci`-তে থামে: API lockfile নেই

[CI workflow](https://github.com/shazzad098/ATLaS/blob/5296e77bcaef67245b10579fb79b42fed48c3458/.github/workflows/ci.yml#L60-L75) `npm --prefix api ci` চালায়, কিন্তু pinned [`api/` tree](https://github.com/shazzad098/ATLaS/tree/5296e77bcaef67245b10579fb79b42fed48c3458/api)-তে `package-lock.json` নেই। `npm ci`-এর জন্য lockfile দরকার। [সর্বশেষ failed run](https://github.com/shazzad098/ATLaS/actions/runs/41088642073/job/124176350480) API job-এ ওই install step-এ থামে; পরের API typecheck/lint/test/build চালেনি।

**সংশোধন:** `api/package-lock.json` commit/sync করে `npm ci` রাখুন; তারপর CI পুনরায় চালান। API install failure ঠিক না হওয়া পর্যন্ত API tests/quality gates কার্যত যাচাই হচ্ছে না।

### Medium

#### 12. Password-reset form OTP ধাপে identifier হারায়

[`forgot-password-form.tsx`](https://github.com/shazzad098/ATLaS/blob/5296e77bcaef67245b10579fb79b42fed48c3458/src/app/%28auth%29/_components/forgot-password-form.tsx#L31-L40)-এ request action সফল হলে reset form দেখায়, কিন্তু required read-only identifier field-এর value reset state-এ নেই। Hidden field-ও নেই। Browser form validation empty field-এর কারণে submit আটকে যায়; failed attempt-এর rerender-এও identifier empty থাকে।

**প্রভাব:** UI দিয়ে OTP ও নতুন password পাঠিয়ে password reset সম্পন্ন করা যায় না।

**সংশোধন:** request state থেকে identifier ধরে hidden form field-এ submit করুন, read-only display আলাদা রাখুন; end-to-end reset form test যোগ করুন।

#### 13. Refresh token rotation concurrent request-এ atomic নয়

[`rotateSession`](https://github.com/shazzad098/ATLaS/blob/5296e77bcaef67245b10579fb79b42fed48c3458/src/lib/auth/session.ts#L126-L145) token hash দিয়ে session পড়ে, পরে session ID দিয়ে নতুন hash update করে; update-এ পুরোনো hash match বাধ্যতামূলক নয়।

**প্রভাব:** একই refresh cookie নিয়ে একসঙ্গে দুই request গেলে দুটিই read পার করে পৃথক token set issue করতে পারে; stolen token race-এ replay হতে পারে এবং legitimate client-এ divergent cookies তৈরি হতে পারে।

**সংশোধন:** পুরোনো hash, unrevoked state ও expiry-সহ conditional atomic update করুন; ঠিক একটি update সফল না হলে token issue করবেন না। Concurrent refresh test যোগ করুন।

#### 14. OTP issuance-এ per-IP quota নেই

[`requestOtp`](https://github.com/shazzad098/ATLaS/blob/5296e77bcaef67245b10579fb79b42fed48c3458/src/lib/auth/otp.ts#L91-L112) `options.ip` নেয়/সংরক্ষণ করে, কিন্তু send quota শুধু phone-ভিত্তিক। Login action-এর আলাদা limit থাকলেও signup এবং password-reset caller-এ একই IP budget ধারাবাহিকভাবে প্রযোজ্য নয়।

**প্রভাব:** এক source একাধিক নম্বরে signup/reset OTP পাঠিয়ে SMS bombing ও provider cost/availability abuse করতে পারে।

**সংশোধন:** login, signup, resend, reset—সব OTP request-এ datastore-backed per-IP এবং phone+IP/device quota enforce করুন। এক IP থেকে বহু নম্বর target করার tests যোগ করুন।

#### 15. Checkout idempotency key store-ভিত্তিক নয়

[`checkout-service.ts`](https://github.com/shazzad098/ATLaS/blob/5296e77bcaef67245b10579fb79b42fed48c3458/src/lib/services/checkout-service.ts#L99-L112) replay lookup শুধু `idempotencyKey` দিয়ে order খোঁজে; `storeId` দিয়ে scope করে না। Schema-তে key global unique।

**প্রভাব:** অন্য store-এর key জানা/পুনর্ব্যবহৃত হলে replay response-এ অন্য store-এর order metadata ফেরত যাওয়ার সম্ভাবনা আছে; key জানা/প্রকাশিত হওয়া দরকার—তাই এটিকে unconditional data leak নয়, tenant-boundary ও idempotency bug হিসেবে ধরা হয়েছে।

**সংশোধন:** replay lookup `storeId + idempotencyKey` দিয়ে scope করুন এবং compound unique constraint বিবেচনা করুন। Cross-store key reuse regression test যোগ করুন।

#### 16. Concurrent billing sweep duplicate invoice বানাতে পারে

[`runBillingSweep`](https://github.com/shazzad098/ATLaS/blob/5296e77bcaef67245b10579fb79b42fed48c3458/src/lib/services/billing-service.ts#L395-L431) expired ACTIVE subscription পড়ার পরে status update-এর আগেই invoice তৈরি করে। Invoice creation-এ tenant+billing period idempotency guard নেই।

**প্রভাব:** একাধিক cron/worker একই subscription একই সময়ে প্রসেস করলে duplicate renewal invoice ও fee attachment হতে পারে।

**সংশোধন:** subscription atomically claim করুন এবং tenant+billing period-এ unique invoice/upsert দিন; concurrent sweep test যোগ করুন।

#### 17. Onboarding-এ দেখানো terms checkbox server-এ যাচাই হয় না

[Onboarding form](https://github.com/shazzad098/ATLaS/blob/5296e77bcaef67245b10579fb79b42fed48c3458/src/app/onboarding/_components/onboarding-form.tsx#L67)-এ `acceptTerms` checkbox দেখানো হলেও [`createFirstStoreAction`](https://github.com/shazzad098/ATLaS/blob/5296e77bcaef67245b10579fb79b42fed48c3458/src/app/onboarding/actions.ts#L13-L36) সেটি পড়ে/validate করে না।

**প্রভাব:** checkbox না টিকিয়েও বা direct action invoke করেও store create হতে পারে; displayed consent gate কার্যকর নয়।

**সংশোধন:** server action-এ `acceptTerms === "on"` validate করুন এবং প্রযোজ্য হলে terms version ও accepted timestamp persist করুন।

#### 18. API coverage config চালু CI-তে প্রয়োগ হয় না

[`api/jest.config.js`](https://github.com/shazzad098/ATLaS/blob/5296e77bcaef67245b10579fb79b42fed48c3458/api/jest.config.js#L1-L15)-এ coverage collection scope আছে, কিন্তু [`api/package.json`](https://github.com/shazzad098/ATLaS/blob/5296e77bcaef67245b10579fb79b42fed48c3458/api/package.json#L10-L18)-এর test script শুধু `jest --runInBand`; CI-তেও `--coverage`, threshold বা report upload নেই।

**প্রভাব:** API test coverage visibility বা minimum coverage gate নেই—বিশেষত বর্তমান CI install failure-এর কারণে API tests run-ই হচ্ছে না।

**সংশোধন:** `test:coverage` command যোগ করে CI-তে চালান, threshold নির্ধারণ বা report upload করুন; আগে API lockfile/CI install ঠিক করুন।

### Low

#### 19. Account পেজে non-super-admin-দের জন্য dead-end audit link

[`account/page.tsx`](https://github.com/shazzad098/ATLaS/blob/5296e77bcaef67245b10579fb79b42fed48c3458/src/app/account/page.tsx#L140-L147) সব account-এ `/super-admin/audit` link দেখায়; [`super-admin/layout.tsx`](https://github.com/shazzad098/ATLaS/blob/5296e77bcaef67245b10579fb79b42fed48c3458/src/app/super-admin/layout.tsx#L15-L18) সাধারণ user-কে `/admin`-এ redirect করে।

**প্রভাব:** সাধারণ merchant-এর কাছে ব্যবহার-অযোগ্য navigation control দেখা যায়।

**সংশোধন:** link শুধু super-admin-কে দেখান অথবা merchant-এর জন্য account activity page দিন; server-side guard রেখে দিন।

## OTP/login বিষয়ে নির্দিষ্ট উত্তর

এই pinned `main` commit-এ `verifyOtp` code Bengali digit normalize করে—[`normalizeOtpCode`](https://github.com/shazzad098/ATLaS/blob/5296e77bcaef67245b10579fb79b42fed48c3458/src/lib/auth/otp.ts#L24-L45) ব্যবহার করে—তাই এই branch-এর source অনুযায়ী শুধু বাংলা অঙ্ক টাইপ করাই OTP mismatch হওয়ার কারণ হওয়ার কথা নয়। তবে OTP signup/reset rate limit এবং password-reset form-এর আলাদা সমস্যা আছে।

Login-এর পর দেখা generic Bengali server error-টির সুনির্দিষ্ট runtime exception এই static audit থেকে বের করা সম্ভব হয়নি। Database connectivity, deploy-এ migration state, runtime configuration বা অন্য server exception হতে পারে; deployed version ও server stack trace ছাড়া নির্দিষ্ট root cause বলা যাবে না।

## CI, scope ও audit সীমা

GitHub Actions-এর [commit `5296e77` run](https://github.com/shazzad098/ATLaS/actions/runs/41088642073) failed। Web job typecheck ও lint পেরিয়ে `npm test`-এ failed; API job `npm --prefix api ci`-তে failed এবং পরবর্তী API checks skip হয়েছে। Public job page-এ পূর্ণ stderr/log পাওয়া যায়নি, তাই Web test failure-এর নির্দিষ্ট test/error এখান থেকে নিশ্চিত নয়।

Audit-এ auth/OTP, Prisma/schema/migrations/seed, Next API ও tenant authorization, commerce/payment/billing, storefront/proxy, admin/account/onboarding, config/deployment, tests/CI—এই মূল runtime ক্ষেত্রগুলো দেখা হয়েছে। `docker-compose.prod.yml`-এ dedicated `migrate` service আছে এবং README-তেও production deployment-এর আগে `prisma migrate deploy` বলা আছে; তাই “সব production deployment migration ছাড়াই চলে” এমন finding করা হয়নি।

এটি public source-এর static review; local build/test বা live application চালানো হয়নি। কারণ `D:\Projects\ATLaS` checkout-এর Git origin `ATLaS-Org30/E-commerce-SAAS.git`, আপনার দেওয়া `shazzad098/ATLaS` নয়; Windows TLS error-এর কারণে exact public repository clone-ও করা যায়নি। তাই local checkout-এ কোনো ফাইল পরিবর্তন করা হয়নি এবং findings-গুলো কেবল নির্দিষ্ট GitHub commit-এর জন্য প্রযোজ্য। Deployed application যদি অন্য commit/build চালায়, সেই version আলাদা করে পরীক্ষা করতে হবে।

---

## Post-fix status (2026-10-31)

বর্তমান working tree-তে findings-গুলো আবার যাচাই করে প্রযোজ্যগুলো ঠিক করা হয়েছে:

| # | Status | সংক্ষিপ্ত পরিবর্তন |
|---|---|---|
| 1 | Fixed | `next.config.ts`-এ `.env.local` inject করার `env` block নেই; শুধু `NEXT_PUBLIC_*` ব্যবহার হয়। |
| 2 | Fixed | `prisma/seed.ts` production-এ `SEED_PASSWORD` ছাড়া fail closed করে। |
| 3 | Fixed | `src/lib/env.ts`-এ কোনো hard-coded SMS fallback নেই; production-এ SMS unconfigured হলে OTP fail closed। |
| 4 | Not present | বর্তমান `otp.ts`-এ কোনো `bulksmsbd`/plaintext HTTP branch নেই; provider endpoint HTTPS। |
| 5 | Fixed | billing API routes-এ `billing:read`; admin plan actions-এ `billing:write` আগেই ছিল। |
| 6 | Fixed | successful callback-এ amount ও provider txn id বাধ্যতামূলক; Nagad/bKash/SSL verified response থেকে amount/order binding। |
| 7 | Fixed | refund amount limit, captured-minus-refunded balance, state guard, row lock ও idempotency key। |
| 8 | Fixed | proxy এখন forwarded/Host header থেকে custom hostname নেয়; `_host` context থেকে `storeId` resolve করা হয়; `storePath()` custom host-এ root-relative path দেয়। Locally `Host: shop.test.local` দিয়ে `/`, `/shop`, `/cart`, `/checkout` যাচাই করা হয়েছে। |
| 9 | Fixed | order tracking-এ signed high-entropy token অথবা verified phone বাধ্যতামূলক। |
| 10 | Fixed | `revokeSession`-এ `userId` predicate এবং current-session guard আছে। |
| 11 | N/A | এই checkout-এ `api/` project নেই; root CI `npm ci` lockfile সহ চলে। |
| 12 | Fixed | forgot-password reset form hidden `identifier` field ব্যবহার করে। |
| 13 | Fixed | refresh rotation এখন old hash-এর উপর atomic compare-and-swap। |
| 14 | Fixed | OTP issuance-এ datastore-backed per-IP hourly quota যোগ করা হয়েছে। |
| 15 | Fixed | checkout replay lookup store-scoped; নতুন order composite idempotency key রাখে। |
| 16 | Fixed | billing sweep invoice তৈরির আগে subscription atomically claim করে; failure-এ claim release করে। |
| 17 | Fixed | onboarding terms checkbox server-side validate হয় এবং acceptance audit log-এ যায়। |
| 18 | N/A | `api/` project নেই; API coverage gate প্রযোজ্য নয়। |
| 19 | Fixed | `/super-admin/audit` link শুধু super-admin-কে দেখানো হয়। |

Verification in this checkout: `npm run typecheck`, `npm run lint`, `npm test` (78 pass, 0 skip with `RUN_DB_TESTS=1`) এবং `npm run build` — সব pass। Docker image (`atlas:ci`) build করা হয়েছে এবং disposable PostgreSQL container-এ migrate + seed + health + admin/super-admin page smoke test pass করেছে; CI-তেও `docker build` job যোগ করা হয়েছে। SMS/payment provider credential revoke/rotate এখনও deployment operator-এর কাজ।

### Additional completeness fixes (2026-11-01)

- Marketing demo-store links এখন DB-তে published demo store থাকলেই দেখায়; না থাকলে লিংক/সেকশন hide হয় (`src/lib/demo-stores.ts`)।
- `root /robots.txt` ও dynamic `/sitemap.xml` যোগ করা হয়েছে।
- Storefront-এ `/page/returns`, `/page/contact`, `/page/delivery`, `/page/privacy`, `/page/terms`-এর built-in fallback যোগ করা হয়েছে; Admin → Settings-এর policy text সেগুলোতে ব্যবহার হয়।
- নতুন **Admin → পেজ** (`/admin/pages`) editor: create/edit/archive custom content page, `design:write` permission ও audit log সহ।
- `npm run integrations:check` যোগ করা হয়েছে—DB/auth/SMS/email/payment/courier/storage readiness এক command-এ দেখায়।
- Super Admin-এর `/api/v1/me` এখন 403 না দিয়ে `superAdmin: true, tenant: null, plan: null, stores: []` ফেরত দেয়।
- CI-তে production Docker image build job যোগ করা হয়েছে।
- `.env.example`-এ SMS/email/storage/S3/pool/test-এর missing variables যোগ করা হয়েছে।
