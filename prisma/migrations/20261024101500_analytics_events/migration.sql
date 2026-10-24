CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "storeId" TEXT,
    "actorId" TEXT,
    "name" TEXT NOT NULL,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AnalyticsEvent_name_occurredAt_idx" ON "AnalyticsEvent"("name", "occurredAt");
CREATE INDEX "AnalyticsEvent_tenantId_occurredAt_idx" ON "AnalyticsEvent"("tenantId", "occurredAt");
CREATE INDEX "AnalyticsEvent_storeId_name_occurredAt_idx" ON "AnalyticsEvent"("storeId", "name", "occurredAt");
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
