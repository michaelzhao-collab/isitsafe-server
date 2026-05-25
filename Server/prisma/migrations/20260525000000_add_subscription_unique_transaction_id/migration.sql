-- 防并发竞态：同一 Apple transactionId 不能产生重复 Subscription 记录
-- Step 1: 清理历史重复（保留每组中 updatedAt 最新的一条）
WITH ranked AS (
  SELECT id,
         transaction_id,
         ROW_NUMBER() OVER (
           PARTITION BY transaction_id
           ORDER BY updated_at DESC, created_at DESC
         ) AS rn
  FROM subscriptions
  WHERE transaction_id IS NOT NULL
)
DELETE FROM subscriptions
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Step 2: 加唯一约束（PostgreSQL 中 NULL 视为相互不等，所以多条 NULL transactionId 仍然允许）
CREATE UNIQUE INDEX "subscriptions_transaction_id_uq"
  ON "subscriptions" ("transaction_id");
