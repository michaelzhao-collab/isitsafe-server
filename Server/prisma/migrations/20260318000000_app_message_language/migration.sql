-- 为 app_messages 增加 language 字段，用于区分中英文消息
ALTER TABLE "app_messages"
ADD COLUMN IF NOT EXISTS "language" VARCHAR(10) NOT NULL DEFAULT 'zh';

-- 为 language 建索引，提升按语言过滤的查询性能
CREATE INDEX IF NOT EXISTS "app_messages_language_idx"
ON "app_messages"("language");

