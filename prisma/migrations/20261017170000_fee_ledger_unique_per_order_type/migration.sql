-- One ledger row per fee type per order, so fee recalculation is idempotent.
-- Order-level fees are unique on (orderId, feeType); rows with a NULL orderId
-- (tenant-level adjustments) are unaffected because PostgreSQL treats NULLs as
-- distinct in a unique index.

CREATE UNIQUE INDEX "FeeLedger_orderId_feeType_key" ON "FeeLedger" ("orderId", "feeType");
