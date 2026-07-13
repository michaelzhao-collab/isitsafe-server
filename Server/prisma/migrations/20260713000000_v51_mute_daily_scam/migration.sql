-- V5.1 收尾：群聊免打扰 + 每日一骗审核队列

-- 1) 群聊免打扰：家庭成员在该群不收聊天离线推送横幅（角标仍算未读）
ALTER TABLE "family_members" ADD COLUMN "chat_muted" BOOLEAN NOT NULL DEFAULT false;

-- 2) 每日一骗候选 + 人工审核队列
CREATE TABLE "daily_scam_candidates" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "summary" TEXT NOT NULL,
    "risk_level" TEXT NOT NULL DEFAULT 'high',
    "ref_type" TEXT,
    "ref_id" TEXT,
    "deep_link" TEXT,
    "scheduled_date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "sent_group_count" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "daily_scam_candidates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "daily_scam_candidates_status_scheduled_date_idx" ON "daily_scam_candidates"("status", "scheduled_date");
