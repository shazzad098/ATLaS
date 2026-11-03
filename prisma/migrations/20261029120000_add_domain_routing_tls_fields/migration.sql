-- Domain routing/TLS verification columns used by the settings, domain and
-- publish-readiness screens.
--
-- These fields shipped in `prisma/schema.prisma` without a matching migration,
-- so a database created with `prisma migrate deploy` (or the seed command) was
-- missing them and `/admin/settings` failed with:
--   The column `Domain.routingTarget` does not exist in the current database.
--
-- IF NOT EXISTS keeps the migration safe for databases that were previously
-- synced with `prisma db push`.

ALTER TABLE "Domain" ADD COLUMN IF NOT EXISTS "dnsError" TEXT;
ALTER TABLE "Domain" ADD COLUMN IF NOT EXISTS "dnsLastCheckedAt" TIMESTAMP(3);
ALTER TABLE "Domain" ADD COLUMN IF NOT EXISTS "routingTarget" TEXT;
ALTER TABLE "Domain" ADD COLUMN IF NOT EXISTS "tlsAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Domain" ADD COLUMN IF NOT EXISTS "tlsError" TEXT;
ALTER TABLE "Domain" ADD COLUMN IF NOT EXISTS "tlsIssuedAt" TIMESTAMP(3);
ALTER TABLE "Domain" ADD COLUMN IF NOT EXISTS "tlsLastCheckedAt" TIMESTAMP(3);
