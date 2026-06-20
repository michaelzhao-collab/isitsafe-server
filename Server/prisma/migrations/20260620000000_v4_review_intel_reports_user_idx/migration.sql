-- V4 复核 #12：intel_reports 之前只有 (intel_id) 单列索引 + (intel_id, user_id) 复合 unique。
-- Postgres 不会自动给 FK 建索引，按 user_id 反查（合规封号 / 查某用户全部举报）走 seq scan。
-- 这里补一个单列索引；IF NOT EXISTS 让重复部署安全。
CREATE INDEX IF NOT EXISTS "intel_reports_user_id_idx" ON "intel_reports"("user_id");
