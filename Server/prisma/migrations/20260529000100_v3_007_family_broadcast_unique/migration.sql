-- =====================================================
-- V3-007 family_broadcasts 当日唯一约束（partial unique）
--
-- 背景：
--   PRD 要求"同家庭同 content_hash 当日仅 1 条"，但 Prisma schema 无法
--   表达 UNIQUE(group_id, content_hash, DATE(created_at))，之前只在 service
--   层用 findFirst 校验，并发场景（同秒两人触发同号码）下会失效。
--
-- 实现：
--   - created_at 是 timestamp without time zone（IMMUTABLE 的 date()），可作
--     表达式索引。
--   - 用 PARTIAL UNIQUE INDEX，避免 NULL 行干扰（实际 created_at NOT NULL，
--     所以 partial 条件用 1=1 占位即可）。
--   - 一旦命中冲突，service 层会收到 P2002 错误，按"重复"路径返回。
--
-- 注意：
--   此索引基于服务器时间。S3 实施"按 user.regionCode 时区"时，需评估是否
--   改为存 created_date 列 + 普通 UNIQUE，或继续以服务器日为准（家庭跨时区
--   场景再讨论）。一期先服务器日，跟当前 service / cron 行为一致。
-- =====================================================

-- 在加唯一索引前先清理可能已有的重复数据（理论上 service 校验过，但插入
-- 索引会因为残留数据失败，所以保留最早的一条，删后到的）。
DELETE FROM "family_broadcasts" a
USING "family_broadcasts" b
WHERE a."group_id"     = b."group_id"
  AND a."content_hash" = b."content_hash"
  AND date(a."created_at") = date(b."created_at")
  AND a."created_at" > b."created_at";

CREATE UNIQUE INDEX "family_broadcasts_group_hash_day_unique"
  ON "family_broadcasts" ("group_id", "content_hash", (date("created_at")));
