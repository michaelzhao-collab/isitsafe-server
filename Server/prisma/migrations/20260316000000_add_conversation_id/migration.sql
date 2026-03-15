-- 同一对话内多条消息共用一个 conversation_id，历史列表按会话聚合为一条
ALTER TABLE "queries" ADD COLUMN IF NOT EXISTS "conversation_id" TEXT;
CREATE INDEX IF NOT EXISTS "queries_conversation_id_idx" ON "queries"("conversation_id");
