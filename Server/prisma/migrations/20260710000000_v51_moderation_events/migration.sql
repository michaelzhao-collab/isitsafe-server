-- V5.1 举报/拉黑 + 家庭事件流

CREATE TABLE "im_moderations" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reporter_id" TEXT NOT NULL,
    "group_id" TEXT,
    "im_msg_id" TEXT,
    "target_id" TEXT,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "im_moderations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "im_moderations_type_status_created_at_idx" ON "im_moderations"("type", "status", "created_at");
CREATE INDEX "im_moderations_reporter_id_idx" ON "im_moderations"("reporter_id");

CREATE TABLE "family_events" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "card_type" TEXT NOT NULL,
    "risk_level" TEXT,
    "ref_type" TEXT,
    "ref_id" TEXT,
    "im_msg_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "handled_by" TEXT,
    "handled_at" TIMESTAMP(3),
    "read_by" JSONB,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "family_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "family_events_group_id_created_at_idx" ON "family_events"("group_id", "created_at");
CREATE INDEX "family_events_group_id_card_type_created_at_idx" ON "family_events"("group_id", "card_type", "created_at");
