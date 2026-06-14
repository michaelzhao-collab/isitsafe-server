-- V4-P3 关怀提醒静音表
-- 业主反馈：对方一直不活跃会一直收到 push，需要按对象关闭

CREATE TABLE "family_care_mutes" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "recipient_user_id" TEXT NOT NULL,
    "target_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "family_care_mutes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "family_care_mutes_group_id_recipient_user_id_target_user_id_key"
    ON "family_care_mutes"("group_id", "recipient_user_id", "target_user_id");

CREATE INDEX "family_care_mutes_recipient_user_id_idx"
    ON "family_care_mutes"("recipient_user_id");
