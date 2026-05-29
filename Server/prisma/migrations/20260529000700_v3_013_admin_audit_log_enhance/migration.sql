-- =====================================================
-- V3-013 admin_audit_logs 字段补全（S3-7）
--
-- 老结构：仅 id/admin_id/action/target_id/created_at，过于简陋
-- 新增：target_type / before_value / after_value JSONB / ip_address / user_agent
-- 老数据 default NULL，行为兼容
-- =====================================================

ALTER TABLE "admin_audit_logs"
  ADD COLUMN "target_type" VARCHAR(40);

ALTER TABLE "admin_audit_logs"
  ADD COLUMN "before_value" JSONB;

ALTER TABLE "admin_audit_logs"
  ADD COLUMN "after_value" JSONB;

ALTER TABLE "admin_audit_logs"
  ADD COLUMN "ip_address" VARCHAR(64);

ALTER TABLE "admin_audit_logs"
  ADD COLUMN "user_agent" VARCHAR(256);

-- action 列长度补到 80（与 Prisma schema 对齐）
ALTER TABLE "admin_audit_logs"
  ALTER COLUMN "action" TYPE VARCHAR(80);

CREATE INDEX "admin_audit_logs_target_type_target_id_idx"
  ON "admin_audit_logs" ("target_type", "target_id");

CREATE INDEX "admin_audit_logs_action_created_at_idx"
  ON "admin_audit_logs" ("action", "created_at" DESC);
