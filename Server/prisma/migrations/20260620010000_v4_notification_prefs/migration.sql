-- V4 通知偏好（业主反馈：家人长期不活跃会一直收到关怀 push）
-- 默认 true → 不改变现有用户体验；用户可主动关
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "push_all_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "push_family_care_enabled" BOOLEAN NOT NULL DEFAULT true;
