-- V4 案例库举报（与 intel_reports 同结构）：一人一案例一次
-- 上报后该案例对该用户视角直接隐藏（list / detail / 详情直链均 404）
CREATE TABLE IF NOT EXISTS "knowledge_reports" (
    "id"           TEXT NOT NULL,
    "knowledge_id" TEXT NOT NULL,
    "user_id"      TEXT NOT NULL,
    "reason"       VARCHAR(32) NOT NULL,
    "note"         TEXT,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_reports_pkey" PRIMARY KEY ("id")
);

-- 一人一案例只能举报一次
CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_reports_knowledge_id_user_id_key"
    ON "knowledge_reports"("knowledge_id", "user_id");

-- 按案例反查（admin 审核队列、排序）
CREATE INDEX IF NOT EXISTS "knowledge_reports_knowledge_id_idx"
    ON "knowledge_reports"("knowledge_id");

-- 按用户反查（合规封号、查某人全部举报）
CREATE INDEX IF NOT EXISTS "knowledge_reports_user_id_idx"
    ON "knowledge_reports"("user_id");

-- FK 配 Cascade（案例 / 用户删除时同步清理）
ALTER TABLE "knowledge_reports"
    ADD CONSTRAINT "knowledge_reports_knowledge_id_fkey"
    FOREIGN KEY ("knowledge_id") REFERENCES "knowledge_cases"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "knowledge_reports"
    ADD CONSTRAINT "knowledge_reports_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
