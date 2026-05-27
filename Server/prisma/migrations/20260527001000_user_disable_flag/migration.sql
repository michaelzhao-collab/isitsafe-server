-- 给 users 表加禁用开关字段（默认 false，老用户零影响）
ALTER TABLE "users"
  ADD COLUMN "is_disabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "disabled_at" TIMESTAMP(3),
  ADD COLUMN "disabled_reason" TEXT;

-- 索引（便于管理后台按状态筛选；is_disabled=true 仅极少数）
CREATE INDEX "users_is_disabled_idx" ON "users"("is_disabled");
