-- CreateEnum
CREATE TYPE "CourierProvider" AS ENUM ('PATHAO', 'REDX', 'STEADFAST');

-- CreateTable
CREATE TABLE "DeliveryMethod" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "provider" "CourierProvider" NOT NULL,
    "courierStoreId" TEXT NOT NULL DEFAULT '',
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryMethod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeliveryMethod_storeId_isEnabled_idx" ON "DeliveryMethod"("storeId", "isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryMethod_storeId_provider_key" ON "DeliveryMethod"("storeId", "provider");

-- AddForeignKey
ALTER TABLE "DeliveryMethod" ADD CONSTRAINT "DeliveryMethod_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
