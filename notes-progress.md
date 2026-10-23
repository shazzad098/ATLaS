# Build progress notes (for continuity)

Project: /home/ubuntu/atlas (webdev web-db-user, server+db, TiDB MySQL). Plan: plan.md, TODO: TODO.md, reference notes: notes-reference.md.
Images: shared/assets.ts (IMG.*). Generated async; use URLs as-is.

## Done
- drizzle/schema.ts (59 tables) migrated (0001). Uses shared/domain.ts constants.
- shared/domain.ts (order states/transitions, providers, couriers, analytics events, BD phone, districts, slug rules, ROOT_STORE_DOMAIN)
- shared/plans.ts (PLAN_SEEDS, COMPARISON_ROWS, FREE_TRIAL_PLAN=standard, GRACE/READ_ONLY/RETRY/REMINDER constants)
- shared/permissions.ts (PERMISSIONS, SYSTEM_ROLES w/ minPlan, PLATFORM_ACCESS)
- shared/themeContract.ts (ThemeConfig, buildThemeSchema(supportedSections), THEME_CATALOG 7 themes, buildDefaultConfig, FONTS)
- server/db.ts (db(), affected(), Tx, DbOrTx)
- server/lib/core.ts (toP/fromP/pctOf money in poisha, dhaka time, monthPeriod, AppError/fail/assertFound, slugify)
- server/lib/crypto.ts (sha256, tokenHash, encryptSecret/decryptSecret(label), signJwt/verifyJwt, TOTP)
- server/lib/rateLimit.ts (consume(scope,key,limit,windowMs,ip), clientIp, recordRequest, apiHealthSummary)
- server/modules/jobs.ts (registerJob, enqueue, every(name,ms,fn), startWorker, retryJob)
- server/modules/ops.ts (audit, track, notifyUsers, notifyTenant(tenantId, perm, n), sendSms/sendEmail/sendWhatsApp outbox, emitEvent webhooks + job webhook.deliver, assertPublicUrl, markNotificationsRead)
- server/modules/auth.ts (cookies atlas_at/atlas_rt/atlas_dev; createSession, verifyAccess, rotateRefresh, revoke*, requestOtp/consumeOtp, signup, verifyPhone, loginWithPassword, loginWithOtp, resetPassword, changePassword, begin2fa/confirm2fa/disable2fa/pass2fa, requestDeletion/cancelDeletion/deletionStatus, sandboxOtpLoginAllowed, toPublicUser, getUserById)
- server/modules/billing.ts (getPlans/planByCode/planById/planRank, getEntitlements(tenantId) → Entitlements{limits, writable, storefrontLive, acceptingOrders,...}, assertWritable/assertFeature/assertProductQuota/assertStorageQuota/assertStaffSeat, incrementUsage/usageFor, recordEligibleSale/voidSaleFee/partialRefundFee/recordCourierFee/voidCourierFee, startSubscription, createInvoice, onInvoicePaid, advanceLifecycle, changePlan, setCancelAtPeriodEnd, setAutoRenew, saveMethod, billingOverview, invoiceDetail, adminSubscriptionAction). Needs payments.recordPlatformCharge(invoice, provider, success).
- server/modules/tenancy.ts (TenantScope, systemRoles/roleId, listWorkspaces, resolveScope(user, tenantId) incl impersonation, requirePerm/requireWrite, staff invite/accept/role/remove, rolesForPlan)

## Remaining (server)
stores.ts (checkSlug, createStore onboarding, checklist, publish, settings, pages), themes.ts (registry, allowed by tier, select w/ compatibility + Basic lock, saveDraft Ajv, publish atomic, live = latest publishedAt), domains.ts, catalog.ts + inventory, checkout.ts (cart, coupon, checkout w/ reservation), orders.ts (state machine, stock commit, fee, refunds, returns), payments.ts (sandbox adapters bkash/nagad/sslcommerz, webhook verify+idempotency, recordPlatformCharge, expiry, reconciliation), couriers.ts, reports.ts, support/apiKeys, platform admin, seed.ts; trpc context + routers; REST /api/v1 + openapi; SEO html transform; uploads endpoint.
## Remaining (client) all pages: marketing (replica), auth, onboarding, merchant admin, storefront themes, super admin, gateway simulator, demo SMS inbox.

## Update 23:40 — more modules done
- server/modules/themes.ts: validateConfig(version,cfg) Ajv, tierAllowed(limits,tier), listThemes({includeInactive}), themeByCode, latestPublishedVersion, switchPolicy(ent, selected), storeThemeState(scope), selectTheme(scope, code, confirm, actorId) dry-run report, saveDraft(scope,cfg,actorId), publishTheme(scope,actorId) atomic, discardDraft, storefrontTheme(storeId, preview) → {themeCode, themeName, config, preview}, adminUpsertTheme, adminCreateVersion({themeId, version, sections, changelog, publish}), adminSetVersionStatus, adminRollout(versionId), themeUsage().
- server/modules/stores.ts: checkSlug(raw), createStore(user, CreateStoreInput, ip) (tenant, owner membership, store, settings, subdomain domain row, default pages, 2 delivery zones, cod payment method, store theme draft, startSubscription trial), onboardingChecklist(scope), markOnboarding(storeId, key), publishStore/unpublishStore(scope, actorId), getSettings, updateProfile, updateStoreSettings, listPages/upsertPage/deletePage, storeBySlug, storeByHost, clearStoreCache, storeSummary.
- server/modules/domains.ts: listDomains, addCustomDomain, verifyDomain (real dns TXT `_atlas-verify.host` = `atlas-verify=token`, CNAME → edge.atlas.example), job domain.tls, setPrimaryDomain, removeDomain.
- server/modules/catalog.ts: listCategories(storeId, includeHidden), upsertCategory, deleteCategory, ProductInput type, createProduct(scope,input,actorId,{skipQuota,source}), updateProduct, setProductStatus(scope, ids, status, actorId), deleteProduct, listProducts(storeId, {search,status,categoryId,page,pageSize,lowStock,sort,featured,ids}), getProduct(storeId, idOrSlug), adjustStock(scope, variantId, delta, reason, actorId), checkLowStock, reserveStock(tx, storeId, variantId, qty, ref)→bool, releaseStock, commitStock, restock, inventoryLedger, inventoryOverview, CSV_COLUMNS, planImport(scope,csv), commitImport, exportProductsCsv, uploadAsset(scope,{filename,mimeType,dataBase64,kind}), deleteAsset, listAssets.
- server/modules/orders.ts: transitionOrder(orderId, to, actor, note, {skipRefund}), notifyCustomerStatus, notifyOrderPlaced(o, 'placed'|'paid'), trackingPath(slug,o), merchantTransition(scope, id, to, note), addNote, listOrders(scope,q), orderDetail(storeId,id), requestRefund, reviewRefund (uses payments.refundPayment(paymentId, amountP, reason)→bool), customerOrder(storeId, orderNo, token), customerRequestReturn, customerCancel, periodic expire-unpaid-orders (60 min), trackPaymentSuccess(o).

## Next design (to implement)
- checkout.ts: server carts by sessionKey (client localStorage), quote with coupon/zone/tax, placeOrder (idempotencyKey, blacklist check, reserve stock atomic, customer upsert, orderNo = PREFIX-seq via stores.orderSeq, coupon usedCount conditional), COD → PENDING_PAYMENT + cod_pending; online → payments.initiateOrderPayment → redirect `/pay/{provider}/{reference}`; retryPayment / switch to COD.
- payments.ts: sandbox adapters bkash/nagad/sslcommerz (sandboxGatewayTransactions), HMAC webhook header x-sandbox-signature, handleGatewayWebhook(provider, rawBody, sig) idempotent via paymentWebhookEvents unique; callback GET /api/payments/callback/:reference queries adapter; markPaymentSucceeded conditional update; platform invoice payments → billing.onInvoicePaid; recordPlatformCharge(invoice, provider, success); refundPayment(paymentId, amountP, reason); expiry job 15 min; reconciliation; settlement T+2; gateway connect with encrypted creds.
- couriers.ts: sandbox adapters, createShipment (Free=manual only; third party Basic+; recordCourierFee on COD amount), updateShipmentStatus → order DELIVERED/RETURNED, courier webhook signed, publicTrack.
- customers.ts: customers list/segments(new, repeat, vip ≥10000, inactive 60d, blacklisted)/detail/update/blacklist/export(PII perm); coupons CRUD (advanced fields need couponLevel advanced); delivery zones CRUD.
- reports.ts, support/apiKeys/webhooks, admin, seed, trpc routers, REST v1 + OpenAPI, SEO, client.
