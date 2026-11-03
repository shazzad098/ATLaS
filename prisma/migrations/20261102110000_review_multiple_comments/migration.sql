-- Buyers can comment/review a product more than once. Each submission is a new
-- row so previous comments stay in the history; the old one-review-per-product
-- uniqueness is replaced by a lookup index.

DROP INDEX IF EXISTS "ProductReview_customerId_productId_key";

CREATE INDEX IF NOT EXISTS "ProductReview_customerId_productId_createdAt_idx"
  ON "ProductReview"("customerId", "productId", "createdAt");
