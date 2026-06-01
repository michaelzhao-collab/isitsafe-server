-- V4-P2 推送广播历史
CREATE TABLE "push_broadcasts" (
    "id" TEXT NOT NULL,
    "audience" VARCHAR(20) NOT NULL,
    "target_user_id" TEXT,
    "title" VARCHAR(180) NOT NULL,
    "body" VARCHAR(800) NOT NULL,
    "devices_count" INTEGER NOT NULL DEFAULT 0,
    "delivered_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'done',
    "error_message" VARCHAR(500),
    "sent_by_admin_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_broadcasts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "push_broadcasts_created_at_idx" ON "push_broadcasts"("created_at");
CREATE INDEX "push_broadcasts_audience_created_at_idx" ON "push_broadcasts"("audience", "created_at");
