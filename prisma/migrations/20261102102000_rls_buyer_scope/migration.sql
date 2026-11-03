-- Buyer scoping refinement.
--
-- The first policy set allowed anyone with access to a store (including a
-- signed-in buyer) to read every customer and order in that store. Buyers must
-- only see their own customer row, orders, wishlist and cart. Merchant
-- contexts are identified by `app.user_id` being set; buyer contexts only have
-- `app.customer_id` / `app.store_id`.

DROP POLICY IF EXISTS store_isolation ON "Customer";
CREATE POLICY store_isolation ON "Customer" FOR ALL
  USING (
    app_bypass()
    OR "id" = app_customer_id()
    OR (app_user_id() IS NOT NULL AND "storeId" IN (SELECT app_accessible_stores()))
  )
  WITH CHECK (
    app_bypass()
    OR "id" = app_customer_id()
    OR (app_user_id() IS NOT NULL AND "storeId" IN (SELECT app_accessible_stores()))
  );

DROP POLICY IF EXISTS store_isolation ON "Order";
CREATE POLICY store_isolation ON "Order" FOR ALL
  USING (
    app_bypass()
    OR "customerId" = app_customer_id()
    OR (app_user_id() IS NOT NULL AND "storeId" IN (SELECT app_accessible_stores()))
  )
  WITH CHECK (
    app_bypass()
    OR "customerId" = app_customer_id()
    OR (app_user_id() IS NOT NULL AND "storeId" IN (SELECT app_accessible_stores()))
  );

DROP POLICY IF EXISTS store_isolation ON "Cart";
CREATE POLICY store_isolation ON "Cart" FOR ALL
  USING (
    app_bypass()
    OR "customerId" = app_customer_id()
    OR "sessionKey" = app_cart_key()
    OR (app_user_id() IS NOT NULL AND "storeId" IN (SELECT app_accessible_stores()))
  )
  WITH CHECK (
    app_bypass()
    OR "customerId" = app_customer_id()
    OR "sessionKey" = app_cart_key()
    OR (app_user_id() IS NOT NULL AND "storeId" IN (SELECT app_accessible_stores()))
  );

DROP POLICY IF EXISTS customer_isolation ON "WishlistItem";
CREATE POLICY customer_isolation ON "WishlistItem" FOR ALL
  USING (
    app_bypass()
    OR "customerId" = app_customer_id()
    OR (app_user_id() IS NOT NULL AND "storeId" IN (SELECT app_accessible_stores()))
  )
  WITH CHECK (
    app_bypass()
    OR "customerId" = app_customer_id()
    OR (app_user_id() IS NOT NULL AND "storeId" IN (SELECT app_accessible_stores()))
  );

DROP POLICY IF EXISTS store_isolation ON "ProductReview";
CREATE POLICY store_isolation ON "ProductReview" FOR ALL
  USING (
    app_bypass()
    OR "storeId" IN (SELECT app_accessible_stores())
  )
  WITH CHECK (
    app_bypass()
    OR "customerId" = app_customer_id()
    OR (app_user_id() IS NOT NULL AND "storeId" IN (SELECT app_accessible_stores()))
  );

DROP POLICY IF EXISTS review_isolation ON "ReviewComment";
CREATE POLICY review_isolation ON "ReviewComment" FOR ALL
  USING (
    app_bypass()
    OR "customerId" = app_customer_id()
    OR "reviewId" IN (SELECT "id" FROM "ProductReview")
  )
  WITH CHECK (
    app_bypass()
    OR "customerId" = app_customer_id()
    OR (app_user_id() IS NOT NULL AND "reviewId" IN (SELECT "id" FROM "ProductReview"))
  );

DROP POLICY IF EXISTS store_isolation ON "Shipment";
CREATE POLICY store_isolation ON "Shipment" FOR ALL
  USING (
    app_bypass()
    OR (app_user_id() IS NOT NULL AND "storeId" IN (SELECT app_accessible_stores()))
    OR "orderId" IN (SELECT "id" FROM "Order")
  )
  WITH CHECK (
    app_bypass()
    OR (app_user_id() IS NOT NULL AND "storeId" IN (SELECT app_accessible_stores()))
    OR "orderId" IN (SELECT "id" FROM "Order")
  );

DROP POLICY IF EXISTS store_isolation ON "NotificationDelivery";
CREATE POLICY store_isolation ON "NotificationDelivery" FOR ALL
  USING (
    app_bypass()
    OR (app_user_id() IS NOT NULL AND "storeId" IN (SELECT app_accessible_stores()))
    OR "orderId" IN (SELECT "id" FROM "Order")
  )
  WITH CHECK (
    app_bypass()
    OR (app_user_id() IS NOT NULL AND "storeId" IN (SELECT app_accessible_stores()))
    OR "orderId" IN (SELECT "id" FROM "Order")
  );

DROP POLICY IF EXISTS store_isolation ON "PaymentWebhookEvent";
CREATE POLICY store_isolation ON "PaymentWebhookEvent" FOR ALL
  USING (
    app_bypass()
    OR (app_user_id() IS NOT NULL AND "storeId" IN (SELECT app_accessible_stores()))
  )
  WITH CHECK (
    app_bypass()
    OR (app_user_id() IS NOT NULL AND "storeId" IN (SELECT app_accessible_stores()))
  );
