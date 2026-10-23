-- Checkout recovery and concurrency-safe coupon reservations.
ALTER TABLE "Order"
  ADD COLUMN "couponRedeemedAt" TIMESTAMP(3),
  ADD COLUMN "couponReleasedAt" TIMESTAMP(3),
  ADD COLUMN "paymentExpiresAt" TIMESTAMP(3);

ALTER TABLE "Coupon"
  ADD COLUMN "reservedCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "PaymentWebhookEvent"
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "Order_paymentExpiresAt_status_idx"
  ON "Order"("paymentExpiresAt", "status");

CREATE INDEX "Coupon_storeId_reservedCount_idx"
  ON "Coupon"("storeId", "reservedCount");
