-- Subscription enhancement: transaction lineage, lifecycle fields, and first-purchase offer fields

ALTER TABLE "subscriptions"
  ADD COLUMN IF NOT EXISTS "original_transaction_id" TEXT,
  ADD COLUMN IF NOT EXISTS "latest_transaction_id" TEXT,
  ADD COLUMN IF NOT EXISTS "environment" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "auto_renew_status" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "purchase_time" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "refunded_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "revoked_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_event_type" VARCHAR(80);

CREATE INDEX IF NOT EXISTS "subscriptions_status_expire_time_idx"
  ON "subscriptions"("status", "expire_time");
CREATE INDEX IF NOT EXISTS "subscriptions_original_transaction_id_idx"
  ON "subscriptions"("original_transaction_id");
CREATE INDEX IF NOT EXISTS "subscriptions_latest_transaction_id_idx"
  ON "subscriptions"("latest_transaction_id");

ALTER TABLE "membership_plans"
  ADD COLUMN IF NOT EXISTS "intro_price" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "intro_period" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "first_purchase_only" BOOLEAN NOT NULL DEFAULT FALSE;
