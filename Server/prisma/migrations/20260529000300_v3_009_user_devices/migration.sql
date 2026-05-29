-- =====================================================
-- V3-009 user_devices 推送设备登记
--
-- 用途：保存 APNs / FCM device token，供 NotificationService.sendPush 查找
--      并下发。token 全局唯一（设备换用户登录时归属迁移）。
-- =====================================================

CREATE TABLE IF NOT EXISTS "user_devices" (
  "id"                  TEXT NOT NULL,
  "user_id"             TEXT NOT NULL,
  "device_token"        VARCHAR(255) NOT NULL,
  "platform"            VARCHAR(16) NOT NULL,            -- ios | android
  "environment"         VARCHAR(16) NOT NULL DEFAULT 'production', -- production | sandbox
  "app_version"         VARCHAR(32),
  "locale"              VARCHAR(16),
  "failure_count"       INTEGER NOT NULL DEFAULT 0,
  "last_failure_reason" VARCHAR(64),
  "last_seen_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_devices_device_token_unique" ON "user_devices"("device_token");
CREATE INDEX "user_devices_user_id_idx" ON "user_devices"("user_id");
CREATE INDEX "user_devices_failure_count_idx" ON "user_devices"("failure_count");

ALTER TABLE "user_devices"
  ADD CONSTRAINT "user_devices_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_devices"
  ADD CONSTRAINT "user_devices_platform_check"
  CHECK ("platform" IN ('ios', 'android'));

ALTER TABLE "user_devices"
  ADD CONSTRAINT "user_devices_environment_check"
  CHECK ("environment" IN ('production', 'sandbox'));
