-- V3 一期：家庭守护模块 5 张新表
-- 依赖：v3_001（users 表已扩展 family_group_id 等字段）
-- 影响：纯新增，不影响任何现有 V2 表

-- =====================================================
-- 1) family_groups 家庭组
-- =====================================================
CREATE TABLE IF NOT EXISTS "family_groups" (
  "id"                       TEXT NOT NULL,
  "owner_user_id"            TEXT NOT NULL,
  "name"                     VARCHAR(100),
  "invite_code"              VARCHAR(20),
  "invite_code_expires_at"   TIMESTAMP(3),
  "created_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"               TIMESTAMP(3) NOT NULL,

  CONSTRAINT "family_groups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "family_groups_invite_code_key" ON "family_groups"("invite_code");
CREATE INDEX        IF NOT EXISTS "family_groups_owner_user_id_idx" ON "family_groups"("owner_user_id");

ALTER TABLE "family_groups"
  ADD CONSTRAINT "family_groups_owner_user_id_fkey"
  FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =====================================================
-- 2) family_members 家庭成员
-- =====================================================
CREATE TABLE IF NOT EXISTS "family_members" (
  "id"                    TEXT NOT NULL,
  "group_id"              TEXT NOT NULL,
  "user_id"               TEXT NOT NULL,
  "role"                  TEXT NOT NULL, -- owner | guardian | ward
  "share_query_results"   BOOLEAN NOT NULL DEFAULT TRUE,
  "joined_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "family_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "family_members_group_id_user_id_key" ON "family_members"("group_id", "user_id");
CREATE INDEX        IF NOT EXISTS "family_members_user_id_idx"          ON "family_members"("user_id");

ALTER TABLE "family_members"
  ADD CONSTRAINT "family_members_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "family_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "family_members"
  ADD CONSTRAINT "family_members_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 角色合法性约束（数据库层兜底，service 层也校验）
ALTER TABLE "family_members"
  ADD CONSTRAINT "family_members_role_check"
  CHECK ("role" IN ('owner', 'guardian', 'ward'));

-- =====================================================
-- 3) user_activities 用户每日活跃日志（关怀机制核心）
-- 复合主键 (user_id, date)
-- =====================================================
CREATE TABLE IF NOT EXISTS "user_activities" (
  "user_id"           TEXT NOT NULL,
  "date"              DATE NOT NULL,
  "active_count"      INTEGER NOT NULL DEFAULT 0,
  "first_active_at"   TIMESTAMP(3),
  "last_active_at"    TIMESTAMP(3),

  CONSTRAINT "user_activities_pkey" PRIMARY KEY ("user_id", "date")
);

CREATE INDEX IF NOT EXISTS "user_activities_date_idx" ON "user_activities"("date");

ALTER TABLE "user_activities"
  ADD CONSTRAINT "user_activities_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =====================================================
-- 4) family_care_notices 关怀提醒发送记录（防重复轰炸）
-- =====================================================
CREATE TABLE IF NOT EXISTS "family_care_notices" (
  "id"                  TEXT NOT NULL,
  "group_id"            TEXT NOT NULL,
  "inactive_user_id"    TEXT NOT NULL,
  "notified_user_ids"   JSONB NOT NULL,
  "days_inactive"       INTEGER NOT NULL,
  "channel"             TEXT NOT NULL, -- push | sms
  "sent_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "family_care_notices_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "family_care_notices_group_id_sent_at_idx" ON "family_care_notices"("group_id", "sent_at" DESC);

ALTER TABLE "family_care_notices"
  ADD CONSTRAINT "family_care_notices_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "family_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "family_care_notices"
  ADD CONSTRAINT "family_care_notices_channel_check"
  CHECK ("channel" IN ('push', 'sms'));

-- =====================================================
-- 5) family_broadcasts 官方匿名广播
-- triggered_by_user_id 仅服务端可见，前端 DTO 必须 @Exclude
-- 当日同内容排重：service 层用 (group_id, content_hash, DATE(created_at)) 查询去重
-- =====================================================
CREATE TABLE IF NOT EXISTS "family_broadcasts" (
  "id"                      TEXT NOT NULL,
  "group_id"                TEXT NOT NULL,
  "triggered_by_user_id"    TEXT NOT NULL,
  "content_type"            TEXT NOT NULL, -- phone | url | sms | voice
  "content_hash"            TEXT NOT NULL,
  "content_display"         TEXT NOT NULL,
  "result_label"            TEXT NOT NULL, -- scam | safe | unknown
  "result_detail"           JSONB NOT NULL,
  "source"                  TEXT NOT NULL, -- auto_query | manual_share
  "created_at"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "family_broadcasts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "family_broadcasts_group_id_created_at_idx" ON "family_broadcasts"("group_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "family_broadcasts_group_id_content_hash_idx" ON "family_broadcasts"("group_id", "content_hash");

ALTER TABLE "family_broadcasts"
  ADD CONSTRAINT "family_broadcasts_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "family_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "family_broadcasts"
  ADD CONSTRAINT "family_broadcasts_triggered_by_user_id_fkey"
  FOREIGN KEY ("triggered_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "family_broadcasts"
  ADD CONSTRAINT "family_broadcasts_result_label_check"
  CHECK ("result_label" IN ('scam', 'safe', 'unknown'));

ALTER TABLE "family_broadcasts"
  ADD CONSTRAINT "family_broadcasts_source_check"
  CHECK ("source" IN ('auto_query', 'manual_share'));

ALTER TABLE "family_broadcasts"
  ADD CONSTRAINT "family_broadcasts_content_type_check"
  CHECK ("content_type" IN ('phone', 'url', 'sms', 'voice'));
