-- V3 一期 B 模块：情报推送相关 4 张表
-- 依赖：v3_001 user 字段扩展（region_code / language）
-- 影响：纯新增，不影响 V2 任何业务

-- =====================================================
-- 1) intel_alerts 系统全网情报
-- =====================================================
CREATE TABLE IF NOT EXISTS "intel_alerts" (
  "id"                  TEXT NOT NULL,
  "title"               VARCHAR(200) NOT NULL,
  "summary"             TEXT NOT NULL,
  "content_blocks"      JSONB,
  "category"            VARCHAR(64) NOT NULL,
  "severity"            VARCHAR(20) NOT NULL,
  "target_regions"      JSONB NOT NULL,
  "target_audiences"    JSONB NOT NULL,
  "language"            VARCHAR(10) NOT NULL DEFAULT 'zh',
  "source_url"          VARCHAR(500),
  "status"              VARCHAR(20) NOT NULL DEFAULT 'draft',
  "published_at"        TIMESTAMP(3),
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3) NOT NULL,

  CONSTRAINT "intel_alerts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "intel_alerts_status_published_idx" ON "intel_alerts"("status", "published_at" DESC);
CREATE INDEX IF NOT EXISTS "intel_alerts_lang_status_idx"     ON "intel_alerts"("language", "status");

ALTER TABLE "intel_alerts"
  ADD CONSTRAINT "intel_alerts_severity_check"
  CHECK ("severity" IN ('normal', 'high', 'urgent'));

ALTER TABLE "intel_alerts"
  ADD CONSTRAINT "intel_alerts_status_check"
  CHECK ("status" IN ('draft', 'pending', 'published', 'archived'));

-- =====================================================
-- 2) intel_submissions 用户上报
-- =====================================================
CREATE TABLE IF NOT EXISTS "intel_submissions" (
  "id"                  TEXT NOT NULL,
  "user_id"             TEXT NOT NULL,
  "category"            VARCHAR(64),
  "content"             TEXT NOT NULL,
  "attachments"         JSONB,
  "status"              VARCHAR(20) NOT NULL DEFAULT 'pending',
  "merged_to_intel_id"  TEXT,
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3) NOT NULL,

  CONSTRAINT "intel_submissions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "intel_submissions_user_created_idx"  ON "intel_submissions"("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "intel_submissions_status_idx"        ON "intel_submissions"("status", "created_at");

ALTER TABLE "intel_submissions"
  ADD CONSTRAINT "intel_submissions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "intel_submissions"
  ADD CONSTRAINT "intel_submissions_status_check"
  CHECK ("status" IN ('pending', 'approved', 'rejected', 'merged'));

-- =====================================================
-- 3) intel_deliveries 送达日志
-- =====================================================
CREATE TABLE IF NOT EXISTS "intel_deliveries" (
  "id"            TEXT NOT NULL,
  "intel_id"      TEXT NOT NULL,
  "user_id"       TEXT NOT NULL,
  "delivered_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "read_at"       TIMESTAMP(3),

  CONSTRAINT "intel_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "intel_deliveries_intel_user_key" ON "intel_deliveries"("intel_id", "user_id");
CREATE INDEX        IF NOT EXISTS "intel_deliveries_user_time_idx"  ON "intel_deliveries"("user_id", "delivered_at" DESC);

ALTER TABLE "intel_deliveries"
  ADD CONSTRAINT "intel_deliveries_intel_id_fkey"
  FOREIGN KEY ("intel_id") REFERENCES "intel_alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "intel_deliveries"
  ADD CONSTRAINT "intel_deliveries_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =====================================================
-- 4) user_intel_preferences 用户偏好
-- =====================================================
CREATE TABLE IF NOT EXISTS "user_intel_preferences" (
  "user_id"     TEXT NOT NULL,
  "categories"  JSONB NOT NULL DEFAULT '[]',
  "push_freq"   VARCHAR(20) NOT NULL DEFAULT 'daily_1',
  "push_time"   VARCHAR(5),
  "updated_at"  TIMESTAMP(3) NOT NULL,

  CONSTRAINT "user_intel_preferences_pkey" PRIMARY KEY ("user_id")
);

ALTER TABLE "user_intel_preferences"
  ADD CONSTRAINT "user_intel_preferences_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_intel_preferences"
  ADD CONSTRAINT "user_intel_preferences_push_freq_check"
  CHECK ("push_freq" IN ('daily_1', 'daily_3', 'weekly', 'off'));
