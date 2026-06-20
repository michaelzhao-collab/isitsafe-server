-- V4 复核扩展：AppMessage 加 target_user_id 让"家庭已解散"等一对一系统消息
-- 可以复用消息中心，而不必新建 UserNotice 表。
-- null = 全员公告（保持旧行为）；非 null = 仅这位用户可见。
ALTER TABLE "app_messages"
  ADD COLUMN IF NOT EXISTS "target_user_id" TEXT;

-- FK Cascade：用户被删时同时清掉发给他的私人系统消息
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'app_messages_target_user_id_fkey'
  ) THEN
    ALTER TABLE "app_messages"
      ADD CONSTRAINT "app_messages_target_user_id_fkey"
      FOREIGN KEY ("target_user_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 按 (target_user_id, created_at DESC) 索引，让"我的系统消息"查询走索引
CREATE INDEX IF NOT EXISTS "app_messages_target_user_id_created_at_idx"
  ON "app_messages"("target_user_id", "created_at" DESC);
