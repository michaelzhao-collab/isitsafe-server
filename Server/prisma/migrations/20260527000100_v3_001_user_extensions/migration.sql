-- V3 一期：扩展 users 表（6 个新字段，全部带默认值或可空，零回归风险）
-- 依赖：无
-- 影响：V2 现有功能完全不受影响，旧 SELECT * 仍返回原字段

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "family_group_id"     TEXT,
  ADD COLUMN IF NOT EXISTS "user_level"          TEXT NOT NULL DEFAULT 'personal',
  ADD COLUMN IF NOT EXISTS "elder_mode_enabled"  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "language"            TEXT NOT NULL DEFAULT 'zh',
  ADD COLUMN IF NOT EXISTS "region_code"         TEXT,
  ADD COLUMN IF NOT EXISTS "last_active_at"      TIMESTAMP(3);

-- 索引：仅在新字段上加，不动旧索引
CREATE INDEX IF NOT EXISTS "users_family_group_id_idx"  ON "users"("family_group_id");
CREATE INDEX IF NOT EXISTS "users_last_active_at_idx"   ON "users"("last_active_at" DESC);
CREATE INDEX IF NOT EXISTS "users_region_code_idx"      ON "users"("region_code");
