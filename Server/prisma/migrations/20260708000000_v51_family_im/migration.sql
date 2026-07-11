-- V5.1 自建 IM：家庭群聊消息 + 已读游标 + 组内 seq 高水位

-- family_groups 增加 last_seq 高水位
ALTER TABLE "family_groups" ADD COLUMN "last_seq" BIGINT NOT NULL DEFAULT 0;

-- family_messages：群聊消息（Postgres 是唯一事实源）
CREATE TABLE "family_messages" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "seq" BIGINT NOT NULL,
    "sender_id" TEXT,
    "type" TEXT NOT NULL,
    "content" TEXT,
    "payload" JSONB,
    "event_id" TEXT,
    "client_msg_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'normal',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "family_messages_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "family_messages_group_id_seq_key" ON "family_messages"("group_id", "seq");
CREATE UNIQUE INDEX "family_messages_group_id_client_msg_id_key" ON "family_messages"("group_id", "client_msg_id");
CREATE INDEX "family_messages_group_id_seq_idx" ON "family_messages"("group_id", "seq" DESC);
CREATE INDEX "family_messages_event_id_idx" ON "family_messages"("event_id");
ALTER TABLE "family_messages" ADD CONSTRAINT "family_messages_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "family_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- family_read_cursors：每成员每群已读游标
CREATE TABLE "family_read_cursors" (
    "group_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "last_read_seq" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "family_read_cursors_pkey" PRIMARY KEY ("group_id", "user_id")
);
CREATE INDEX "family_read_cursors_user_id_idx" ON "family_read_cursors"("user_id");
ALTER TABLE "family_read_cursors" ADD CONSTRAINT "family_read_cursors_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "family_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
