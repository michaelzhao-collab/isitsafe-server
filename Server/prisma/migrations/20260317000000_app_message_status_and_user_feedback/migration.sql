-- AppMessage 增加 status，默认 active；offline 时客户端不展示
ALTER TABLE "app_messages" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) DEFAULT 'active';
UPDATE "app_messages" SET "status" = 'active' WHERE "status" IS NULL;

-- 用户意见反馈表
CREATE TABLE IF NOT EXISTS "user_feedback" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "user_id" TEXT,
  "content" TEXT NOT NULL,
  "image_url" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "user_feedback_created_at_idx" ON "user_feedback"("created_at");
