-- V3 一期 A1 + F 模块：深伪检测 + 暗网监控
-- 依赖：v3_001 user 字段扩展
-- 影响：纯新增

-- =====================================================
-- 1) deepfake_checks 语音深伪检测记录
-- =====================================================
CREATE TABLE IF NOT EXISTS "deepfake_checks" (
  "id"                    TEXT NOT NULL,
  "user_id"               TEXT NOT NULL,
  "check_type"            VARCHAR(20) NOT NULL DEFAULT 'voice',
  "source_type"           VARCHAR(20) NOT NULL,
  "file_url"              VARCHAR(500),
  "file_duration_sec"     INTEGER,
  "result_score"          DOUBLE PRECISION,
  "result_label"          VARCHAR(20),
  "result_features"       JSONB,
  "ai_provider"           VARCHAR(50),
  "ai_raw_response"       JSONB,
  "status"                VARCHAR(20) NOT NULL DEFAULT 'queued',
  "user_feedback"         VARCHAR(20),
  "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at"          TIMESTAMP(3),
  "expires_at"            TIMESTAMP(3) NOT NULL,

  CONSTRAINT "deepfake_checks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "deepfake_checks_user_time_idx"   ON "deepfake_checks"("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "deepfake_checks_expires_idx"     ON "deepfake_checks"("expires_at");

ALTER TABLE "deepfake_checks"
  ADD CONSTRAINT "deepfake_checks_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "deepfake_checks"
  ADD CONSTRAINT "deepfake_checks_status_check"
  CHECK ("status" IN ('queued', 'processing', 'done', 'failed'));

ALTER TABLE "deepfake_checks"
  ADD CONSTRAINT "deepfake_checks_source_check"
  CHECK ("source_type" IN ('upload', 'record', 'share'));

ALTER TABLE "deepfake_checks"
  ADD CONSTRAINT "deepfake_checks_label_check"
  CHECK ("result_label" IS NULL OR "result_label" IN ('low', 'medium', 'high'));

-- =====================================================
-- 2) breach_targets 暗网监控目标
-- =====================================================
CREATE TABLE IF NOT EXISTS "breach_targets" (
  "id"                          TEXT NOT NULL,
  "user_id"                     TEXT NOT NULL,
  "target_type"                 VARCHAR(20) NOT NULL DEFAULT 'email',
  "target_value_hash"           TEXT NOT NULL,
  "target_value_lookup"         TEXT NOT NULL,
  "verified"                    BOOLEAN NOT NULL DEFAULT FALSE,
  "verification_token"          TEXT,
  "verification_expires_at"     TIMESTAMP(3),
  "last_scanned_at"             TIMESTAMP(3),
  "created_at"                  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "breach_targets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "breach_targets_user_idx"           ON "breach_targets"("user_id");
CREATE INDEX IF NOT EXISTS "breach_targets_verified_scan_idx"  ON "breach_targets"("verified", "last_scanned_at");

ALTER TABLE "breach_targets"
  ADD CONSTRAINT "breach_targets_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "breach_targets"
  ADD CONSTRAINT "breach_targets_type_check"
  CHECK ("target_type" IN ('email', 'phone'));

-- =====================================================
-- 3) breach_alerts 暗网告警
-- =====================================================
CREATE TABLE IF NOT EXISTS "breach_alerts" (
  "id"              TEXT NOT NULL,
  "target_id"       TEXT NOT NULL,
  "user_id"         TEXT NOT NULL,
  "breach_source"   VARCHAR(50) NOT NULL,
  "breach_name"     VARCHAR(200) NOT NULL,
  "breach_date"     DATE,
  "exposed_data"    JSONB NOT NULL,
  "severity"        VARCHAR(20) NOT NULL,
  "dismissed"       BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "breach_alerts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "breach_alerts_user_time_idx" ON "breach_alerts"("user_id", "created_at" DESC);

ALTER TABLE "breach_alerts"
  ADD CONSTRAINT "breach_alerts_target_id_fkey"
  FOREIGN KEY ("target_id") REFERENCES "breach_targets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "breach_alerts"
  ADD CONSTRAINT "breach_alerts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "breach_alerts"
  ADD CONSTRAINT "breach_alerts_severity_check"
  CHECK ("severity" IN ('low', 'medium', 'high'));
