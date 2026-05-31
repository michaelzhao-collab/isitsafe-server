-- V3-K AI 内容抓取
-- 1) 新增 content_fetch_jobs 表
-- 2) intel_alerts 加 source_fetch_job_id 字段 + 索引
-- 3) knowledge_cases 加 status / source_fetch_job_id 字段 + 索引（status 默认 published 不影响老数据可见性）

CREATE TABLE "content_fetch_jobs" (
  "id" TEXT NOT NULL,
  "type" VARCHAR(20) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
  "triggered_by" TEXT NOT NULL,
  "started_at" TIMESTAMP(3),
  "finished_at" TIMESTAMP(3),
  "total_found" INTEGER NOT NULL DEFAULT 0,
  "total_inserted" INTEGER NOT NULL DEFAULT 0,
  "total_duplicated" INTEGER NOT NULL DEFAULT 0,
  "total_failed" INTEGER NOT NULL DEFAULT 0,
  "error_message" TEXT,
  "result_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "content_fetch_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "content_fetch_jobs_type_created_at_idx"
  ON "content_fetch_jobs" ("type", "created_at" DESC);
CREATE INDEX "content_fetch_jobs_triggered_by_created_at_idx"
  ON "content_fetch_jobs" ("triggered_by", "created_at" DESC);

-- intel_alerts.source_fetch_job_id
ALTER TABLE "intel_alerts" ADD COLUMN "source_fetch_job_id" VARCHAR(64);

ALTER TABLE "intel_alerts"
  ADD CONSTRAINT "intel_alerts_source_fetch_job_id_fkey"
  FOREIGN KEY ("source_fetch_job_id") REFERENCES "content_fetch_jobs"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "intel_alerts_source_fetch_job_id_idx"
  ON "intel_alerts" ("source_fetch_job_id");

-- knowledge_cases.status + source_fetch_job_id
ALTER TABLE "knowledge_cases" ADD COLUMN "status" VARCHAR(20) NOT NULL DEFAULT 'published';
ALTER TABLE "knowledge_cases" ADD COLUMN "source_fetch_job_id" VARCHAR(64);

ALTER TABLE "knowledge_cases"
  ADD CONSTRAINT "knowledge_cases_source_fetch_job_id_fkey"
  FOREIGN KEY ("source_fetch_job_id") REFERENCES "content_fetch_jobs"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "knowledge_cases_status_language_idx"
  ON "knowledge_cases" ("status", "language");
CREATE INDEX "knowledge_cases_source_fetch_job_id_idx"
  ON "knowledge_cases" ("source_fetch_job_id");
