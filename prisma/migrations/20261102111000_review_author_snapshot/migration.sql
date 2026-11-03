-- Reviews carry a display-name snapshot. Buyer sessions may read all approved
-- reviews of a store, but RLS hides other customers' Customer rows; the join
-- would otherwise be null (and leak/pay the cost of a privileged read).

ALTER TABLE "ProductReview"
  ADD COLUMN IF NOT EXISTS "authorName" TEXT NOT NULL DEFAULT 'ক্রেতা';

UPDATE "ProductReview" AS r
SET "authorName" = c.name
FROM "Customer" AS c
WHERE c.id = r."customerId"
  AND r."authorName" = 'ক্রেতা';
