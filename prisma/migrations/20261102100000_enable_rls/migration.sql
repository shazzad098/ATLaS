-- Row-Level Security (RLS) for merchant and buyer data.
--
-- Every request that touches the database runs through a context-aware client
-- (see `src/lib/db.ts`). The middleware verifies the session and sets one of:
--
--   * platform / public → `app.bypass = 'on'` (super admin, unauthenticated
--     storefront, auth screens, scripts and migrations)
--   * merchant          → `app.user_id = <user id>`
--   * buyer             → `app.customer_id`, `app.store_id`, `app.cart_key`
--
-- Policies below then restrict rows at the database level, so an application
-- bug that forgets a `tenantId` filter still cannot read another merchant's or
-- buyer's rows. Public storefront access intentionally bypasses RLS because it
-- is unauthenticated by design; authenticated sessions never do.
--
-- Auth metadata (User, Session, OtpChallenge, Membership, Plan, Theme,
-- AuditLog, SupportTicket) is deliberately not row-secured: it is needed before
-- a tenant context exists, and it contains no merchant business data.

-- ── Context helpers ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION app_bypass() RETURNS boolean
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT coalesce(current_setting('app.bypass', true), '') = 'on'
$$;

CREATE OR REPLACE FUNCTION app_user_id() RETURNS text
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT nullif(coalesce(current_setting('app.user_id', true), ''), '')
$$;

CREATE OR REPLACE FUNCTION app_customer_id() RETURNS text
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT nullif(coalesce(current_setting('app.customer_id', true), ''), '')
$$;

CREATE OR REPLACE FUNCTION app_store_id() RETURNS text
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT nullif(coalesce(current_setting('app.store_id', true), ''), '')
$$;

CREATE OR REPLACE FUNCTION app_cart_key() RETURNS text
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT nullif(coalesce(current_setting('app.cart_key', true), ''), '')
$$;

-- Membership intentionally has no RLS, so this can read the caller's tenants.
CREATE OR REPLACE FUNCTION app_user_tenants() RETURNS SETOF text
LANGUAGE sql STABLE AS $$
  SELECT "tenantId"
  FROM "Membership"
  WHERE "userId" = app_user_id() AND "status" = 'ACTIVE'
$$;

-- Stores the caller may read: their tenants' stores, or the buyer's storefront.
-- The Store policy below guards this subquery (no recursive call back here).
CREATE OR REPLACE FUNCTION app_accessible_stores() RETURNS SETOF text
LANGUAGE sql STABLE AS $$
  SELECT "id"
  FROM "Store"
  WHERE "deletedAt" IS NULL
    AND ("tenantId" IN (SELECT app_user_tenants()) OR "id" = app_store_id())
$$;

-- ── Tenant and workspace ────────────────────────────────────────────────────

ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Tenant" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Tenant" FOR ALL
  USING (
    app_bypass()
    OR "id" IN (SELECT app_user_tenants())
    OR "id" = (SELECT "tenantId" FROM "Store" WHERE "id" = app_store_id())
  )
  WITH CHECK (app_bypass() OR "id" IN (SELECT app_user_tenants()));

ALTER TABLE "Store" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Store" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Store" FOR ALL
  USING (
    app_bypass()
    OR "tenantId" IN (SELECT app_user_tenants())
    OR "id" = app_store_id()
  )
  WITH CHECK (app_bypass() OR "tenantId" IN (SELECT app_user_tenants()));

ALTER TABLE "Role" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Role" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Role" FOR ALL
  USING (app_bypass() OR "tenantId" IN (SELECT app_user_tenants()))
  WITH CHECK (app_bypass() OR "tenantId" IN (SELECT app_user_tenants()));

ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subscription" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Subscription" FOR ALL
  USING (app_bypass() OR "tenantId" IN (SELECT app_user_tenants()))
  WITH CHECK (app_bypass() OR "tenantId" IN (SELECT app_user_tenants()));

ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invoice" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Invoice" FOR ALL
  USING (app_bypass() OR "tenantId" IN (SELECT app_user_tenants()))
  WITH CHECK (app_bypass() OR "tenantId" IN (SELECT app_user_tenants()));

ALTER TABLE "UsageCounter" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UsageCounter" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "UsageCounter" FOR ALL
  USING (app_bypass() OR "tenantId" IN (SELECT app_user_tenants()))
  WITH CHECK (app_bypass() OR "tenantId" IN (SELECT app_user_tenants()));

ALTER TABLE "FeeLedger" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FeeLedger" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "FeeLedger" FOR ALL
  USING (app_bypass() OR "tenantId" IN (SELECT app_user_tenants()))
  WITH CHECK (app_bypass() OR "tenantId" IN (SELECT app_user_tenants()));

ALTER TABLE "ExportJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExportJob" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ExportJob" FOR ALL
  USING (app_bypass() OR "tenantId" IN (SELECT app_user_tenants()))
  WITH CHECK (app_bypass() OR "tenantId" IN (SELECT app_user_tenants()));

ALTER TABLE "ExportSchedule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExportSchedule" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ExportSchedule" FOR ALL
  USING (app_bypass() OR "tenantId" IN (SELECT app_user_tenants()))
  WITH CHECK (app_bypass() OR "tenantId" IN (SELECT app_user_tenants()));

ALTER TABLE "WebhookDelivery" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WebhookDelivery" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "WebhookDelivery" FOR ALL
  USING (app_bypass() OR "tenantId" IN (SELECT app_user_tenants()))
  WITH CHECK (app_bypass() OR "tenantId" IN (SELECT app_user_tenants()));

ALTER TABLE "WebhookEndpoint" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WebhookEndpoint" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "WebhookEndpoint" FOR ALL
  USING (app_bypass() OR "tenantId" IN (SELECT app_user_tenants()))
  WITH CHECK (app_bypass() OR "tenantId" IN (SELECT app_user_tenants()));

ALTER TABLE "ApiKey" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApiKey" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ApiKey" FOR ALL
  USING (app_bypass() OR "tenantId" IN (SELECT app_user_tenants()))
  WITH CHECK (app_bypass() OR "tenantId" IN (SELECT app_user_tenants()));

-- ── Storefront content (read by merchants and buyers) ───────────────────────

ALTER TABLE "StoreSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StoreSettings" FORCE ROW LEVEL SECURITY;
CREATE POLICY store_isolation ON "StoreSettings" FOR ALL
  USING (app_bypass() OR "storeId" IN (SELECT app_accessible_stores()))
  WITH CHECK (app_bypass() OR "storeId" IN (SELECT app_accessible_stores()));

ALTER TABLE "StoreTheme" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StoreTheme" FORCE ROW LEVEL SECURITY;
CREATE POLICY store_isolation ON "StoreTheme" FOR ALL
  USING (app_bypass() OR "storeId" IN (SELECT app_accessible_stores()))
  WITH CHECK (app_bypass() OR "storeId" IN (SELECT app_accessible_stores()));

ALTER TABLE "ContentPage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContentPage" FORCE ROW LEVEL SECURITY;
CREATE POLICY store_isolation ON "ContentPage" FOR ALL
  USING (app_bypass() OR "storeId" IN (SELECT app_accessible_stores()))
  WITH CHECK (app_bypass() OR "storeId" IN (SELECT app_accessible_stores()));

ALTER TABLE "Domain" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Domain" FORCE ROW LEVEL SECURITY;
CREATE POLICY store_isolation ON "Domain" FOR ALL
  USING (app_bypass() OR "storeId" IN (SELECT app_accessible_stores()))
  WITH CHECK (app_bypass() OR "storeId" IN (SELECT app_accessible_stores()));

ALTER TABLE "Category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Category" FORCE ROW LEVEL SECURITY;
CREATE POLICY store_isolation ON "Category" FOR ALL
  USING (app_bypass() OR "storeId" IN (SELECT app_accessible_stores()))
  WITH CHECK (app_bypass() OR "storeId" IN (SELECT app_accessible_stores()));

ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Product" FORCE ROW LEVEL SECURITY;
CREATE POLICY store_isolation ON "Product" FOR ALL
  USING (app_bypass() OR "storeId" IN (SELECT app_accessible_stores()))
  WITH CHECK (app_bypass() OR "storeId" IN (SELECT app_accessible_stores()));

ALTER TABLE "ProductVariant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductVariant" FORCE ROW LEVEL SECURITY;
CREATE POLICY product_isolation ON "ProductVariant" FOR ALL
  USING (
    app_bypass()
    OR "productId" IN (
      SELECT "id" FROM "Product" WHERE "storeId" IN (SELECT app_accessible_stores())
    )
  )
  WITH CHECK (
    app_bypass()
    OR "productId" IN (
      SELECT "id" FROM "Product" WHERE "storeId" IN (SELECT app_accessible_stores())
    )
  );

ALTER TABLE "ProductImage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductImage" FORCE ROW LEVEL SECURITY;
CREATE POLICY product_isolation ON "ProductImage" FOR ALL
  USING (
    app_bypass()
    OR "productId" IN (
      SELECT "id" FROM "Product" WHERE "storeId" IN (SELECT app_accessible_stores())
    )
  )
  WITH CHECK (
    app_bypass()
    OR "productId" IN (
      SELECT "id" FROM "Product" WHERE "storeId" IN (SELECT app_accessible_stores())
    )
  );

ALTER TABLE "InventoryMovement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InventoryMovement" FORCE ROW LEVEL SECURITY;
CREATE POLICY store_isolation ON "InventoryMovement" FOR ALL
  USING (app_bypass() OR "storeId" IN (SELECT app_accessible_stores()))
  WITH CHECK (app_bypass() OR "storeId" IN (SELECT app_accessible_stores()));

ALTER TABLE "Asset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Asset" FORCE ROW LEVEL SECURITY;
CREATE POLICY store_isolation ON "Asset" FOR ALL
  USING (app_bypass() OR "storeId" IN (SELECT app_accessible_stores()))
  WITH CHECK (app_bypass() OR "storeId" IN (SELECT app_accessible_stores()));

ALTER TABLE "PaymentMethod" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentMethod" FORCE ROW LEVEL SECURITY;
CREATE POLICY store_isolation ON "PaymentMethod" FOR ALL
  USING (app_bypass() OR "storeId" IN (SELECT app_accessible_stores()))
  WITH CHECK (app_bypass() OR "storeId" IN (SELECT app_accessible_stores()));

ALTER TABLE "Coupon" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Coupon" FORCE ROW LEVEL SECURITY;
CREATE POLICY store_isolation ON "Coupon" FOR ALL
  USING (app_bypass() OR "storeId" IN (SELECT app_accessible_stores()))
  WITH CHECK (app_bypass() OR "storeId" IN (SELECT app_accessible_stores()));

ALTER TABLE "DeliveryZone" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DeliveryZone" FORCE ROW LEVEL SECURITY;
CREATE POLICY store_isolation ON "DeliveryZone" FOR ALL
  USING (app_bypass() OR "storeId" IN (SELECT app_accessible_stores()))
  WITH CHECK (app_bypass() OR "storeId" IN (SELECT app_accessible_stores()));

ALTER TABLE "DeliveryMethod" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DeliveryMethod" FORCE ROW LEVEL SECURITY;
CREATE POLICY store_isolation ON "DeliveryMethod" FOR ALL
  USING (app_bypass() OR "storeId" IN (SELECT app_accessible_stores()))
  WITH CHECK (app_bypass() OR "storeId" IN (SELECT app_accessible_stores()));

ALTER TABLE "DailyStoreMetric" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DailyStoreMetric" FORCE ROW LEVEL SECURITY;
CREATE POLICY store_isolation ON "DailyStoreMetric" FOR ALL
  USING (app_bypass() OR "storeId" IN (SELECT app_accessible_stores()))
  WITH CHECK (app_bypass() OR "storeId" IN (SELECT app_accessible_stores()));

ALTER TABLE "AnalyticsEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AnalyticsEvent" FORCE ROW LEVEL SECURITY;
CREATE POLICY store_isolation ON "AnalyticsEvent" FOR ALL
  USING (
    app_bypass()
    OR "tenantId" IN (SELECT app_user_tenants())
    OR "storeId" IN (SELECT app_accessible_stores())
  )
  WITH CHECK (
    app_bypass()
    OR "tenantId" IN (SELECT app_user_tenants())
    OR "storeId" IN (SELECT app_accessible_stores())
  );

-- ── Buyers, carts and orders ────────────────────────────────────────────────

ALTER TABLE "Customer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Customer" FORCE ROW LEVEL SECURITY;
CREATE POLICY store_isolation ON "Customer" FOR ALL
  USING (
    app_bypass()
    OR "storeId" IN (SELECT app_accessible_stores())
    OR "id" = app_customer_id()
  )
  WITH CHECK (
    app_bypass()
    OR "storeId" IN (SELECT app_accessible_stores())
    OR "id" = app_customer_id()
  );

ALTER TABLE "Cart" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Cart" FORCE ROW LEVEL SECURITY;
CREATE POLICY store_isolation ON "Cart" FOR ALL
  USING (
    app_bypass()
    OR "storeId" IN (SELECT app_accessible_stores())
    OR "customerId" = app_customer_id()
    OR "sessionKey" = app_cart_key()
  )
  WITH CHECK (
    app_bypass()
    OR "storeId" IN (SELECT app_accessible_stores())
    OR "customerId" = app_customer_id()
    OR "sessionKey" = app_cart_key()
  );

ALTER TABLE "CartItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CartItem" FORCE ROW LEVEL SECURITY;
CREATE POLICY cart_isolation ON "CartItem" FOR ALL
  USING (app_bypass() OR "cartId" IN (SELECT "id" FROM "Cart"))
  WITH CHECK (app_bypass() OR "cartId" IN (SELECT "id" FROM "Cart"));

ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Order" FORCE ROW LEVEL SECURITY;
CREATE POLICY store_isolation ON "Order" FOR ALL
  USING (
    app_bypass()
    OR "storeId" IN (SELECT app_accessible_stores())
    OR "customerId" = app_customer_id()
  )
  WITH CHECK (
    app_bypass()
    OR "customerId" = app_customer_id()
    OR (
      app_user_id() IS NOT NULL
      AND "storeId" IN (SELECT app_accessible_stores())
    )
  );

ALTER TABLE "OrderItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderItem" FORCE ROW LEVEL SECURITY;
CREATE POLICY order_isolation ON "OrderItem" FOR ALL
  USING (app_bypass() OR "orderId" IN (SELECT "id" FROM "Order"))
  WITH CHECK (app_bypass() OR "orderId" IN (SELECT "id" FROM "Order"));

ALTER TABLE "OrderEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderEvent" FORCE ROW LEVEL SECURITY;
CREATE POLICY order_isolation ON "OrderEvent" FOR ALL
  USING (app_bypass() OR "orderId" IN (SELECT "id" FROM "Order"))
  WITH CHECK (app_bypass() OR "orderId" IN (SELECT "id" FROM "Order"));

ALTER TABLE "Return" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Return" FORCE ROW LEVEL SECURITY;
CREATE POLICY order_isolation ON "Return" FOR ALL
  USING (app_bypass() OR "orderId" IN (SELECT "id" FROM "Order"))
  WITH CHECK (app_bypass() OR "orderId" IN (SELECT "id" FROM "Order"));

ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" FORCE ROW LEVEL SECURITY;
CREATE POLICY order_isolation ON "Payment" FOR ALL
  USING (app_bypass() OR "orderId" IN (SELECT "id" FROM "Order"))
  WITH CHECK (app_bypass() OR "orderId" IN (SELECT "id" FROM "Order"));

ALTER TABLE "Shipment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Shipment" FORCE ROW LEVEL SECURITY;
CREATE POLICY store_isolation ON "Shipment" FOR ALL
  USING (
    app_bypass()
    OR "storeId" IN (SELECT app_accessible_stores())
    OR "orderId" IN (SELECT "id" FROM "Order")
  )
  WITH CHECK (
    app_bypass()
    OR "storeId" IN (SELECT app_accessible_stores())
    OR "orderId" IN (SELECT "id" FROM "Order")
  );

ALTER TABLE "PaymentWebhookEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentWebhookEvent" FORCE ROW LEVEL SECURITY;
CREATE POLICY store_isolation ON "PaymentWebhookEvent" FOR ALL
  USING (app_bypass() OR "storeId" IN (SELECT app_accessible_stores()))
  WITH CHECK (app_bypass() OR "storeId" IN (SELECT app_accessible_stores()));

ALTER TABLE "NotificationDelivery" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NotificationDelivery" FORCE ROW LEVEL SECURITY;
CREATE POLICY store_isolation ON "NotificationDelivery" FOR ALL
  USING (
    app_bypass()
    OR "storeId" IN (SELECT app_accessible_stores())
    OR "orderId" IN (SELECT "id" FROM "Order")
  )
  WITH CHECK (
    app_bypass()
    OR "storeId" IN (SELECT app_accessible_stores())
    OR "orderId" IN (SELECT "id" FROM "Order")
  );

-- ── Reviews and wishlist ────────────────────────────────────────────────────

ALTER TABLE "ProductReview" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductReview" FORCE ROW LEVEL SECURITY;
CREATE POLICY store_isolation ON "ProductReview" FOR ALL
  USING (
    app_bypass()
    OR "storeId" IN (SELECT app_accessible_stores())
    OR "customerId" = app_customer_id()
  )
  WITH CHECK (
    app_bypass()
    OR "customerId" = app_customer_id()
    OR (
      app_user_id() IS NOT NULL
      AND "storeId" IN (SELECT app_accessible_stores())
    )
  );

ALTER TABLE "ReviewComment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReviewComment" FORCE ROW LEVEL SECURITY;
CREATE POLICY review_isolation ON "ReviewComment" FOR ALL
  USING (
    app_bypass()
    OR "customerId" = app_customer_id()
    OR "reviewId" IN (SELECT "id" FROM "ProductReview")
  )
  WITH CHECK (
    app_bypass()
    OR "customerId" = app_customer_id()
    OR "reviewId" IN (SELECT "id" FROM "ProductReview")
  );

ALTER TABLE "WishlistItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WishlistItem" FORCE ROW LEVEL SECURITY;
CREATE POLICY customer_isolation ON "WishlistItem" FOR ALL
  USING (
    app_bypass()
    OR "customerId" = app_customer_id()
    OR "storeId" IN (SELECT app_accessible_stores())
  )
  WITH CHECK (
    app_bypass()
    OR "customerId" = app_customer_id()
    OR (
      app_user_id() IS NOT NULL
      AND "storeId" IN (SELECT app_accessible_stores())
    )
  );
