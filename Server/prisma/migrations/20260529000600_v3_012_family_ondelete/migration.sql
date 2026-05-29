-- =====================================================
-- V3-012 补全 family 表外键 onDelete 策略
--
-- 问题（S3-4）：
--   - family_groups.owner_user_id 无 onDelete → owner 删号后组孤立
--   - family_broadcasts.triggered_by_user_id 是 RESTRICT 且 NOT NULL
--     → 用户删号会被广播表"扣留"无法删除；
--     → 隐私上保留广播但作者关联应置空更合理
--
-- 修复：
--   - family_groups.owner_user_id → onDelete CASCADE（owner 删 = 家庭组解散）
--   - family_broadcasts.triggered_by_user_id → 改 nullable + onDelete SET NULL
--     广播历史保留，作者关联置空，隐私上反而更符合"匿名广播"语义
-- =====================================================

-- 1) family_groups owner → CASCADE
ALTER TABLE "family_groups"
  DROP CONSTRAINT IF EXISTS "family_groups_owner_user_id_fkey";

ALTER TABLE "family_groups"
  ADD CONSTRAINT "family_groups_owner_user_id_fkey"
  FOREIGN KEY ("owner_user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 2) family_broadcasts triggered_by → nullable + SET NULL
ALTER TABLE "family_broadcasts"
  ALTER COLUMN "triggered_by_user_id" DROP NOT NULL;

ALTER TABLE "family_broadcasts"
  DROP CONSTRAINT IF EXISTS "family_broadcasts_triggered_by_user_id_fkey";

ALTER TABLE "family_broadcasts"
  ADD CONSTRAINT "family_broadcasts_triggered_by_user_id_fkey"
  FOREIGN KEY ("triggered_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
