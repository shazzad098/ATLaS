CREATE TABLE "CourierShipment" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "trackingCode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL DEFAULT '{}',
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourierShipment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CourierShipment_provider_trackingCode_key" ON "CourierShipment"("provider", "trackingCode");
CREATE INDEX "CourierShipment_storeId_status_updatedAt_idx" ON "CourierShipment"("storeId", "status", "updatedAt");
CREATE INDEX "CourierShipment_orderId_idx" ON "CourierShipment"("orderId");

ALTER TABLE "CourierShipment" ADD CONSTRAINT "CourierShipment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourierShipment" ADD CONSTRAINT "CourierShipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CourierWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "signatureValid" BOOLEAN NOT NULL DEFAULT false,
    "payloadHash" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL DEFAULT '{}',
    "processedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourierWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CourierWebhookEvent_provider_eventKey_key" ON "CourierWebhookEvent"("provider", "eventKey");
CREATE INDEX "CourierWebhookEvent_provider_status_idx" ON "CourierWebhookEvent"("provider", "status");
