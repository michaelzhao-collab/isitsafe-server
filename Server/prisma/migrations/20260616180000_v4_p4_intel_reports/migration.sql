-- V4-P4 用户对情报的举报（App Store 1.2 UGC 合规）
-- 一人一情报最多一条；admin 看到后人工决定是否 archived

CREATE TABLE "intel_reports" (
    "id" TEXT NOT NULL,
    "intel_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reason" VARCHAR(32) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intel_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "intel_reports_intel_id_user_id_key"
    ON "intel_reports"("intel_id", "user_id");

CREATE INDEX "intel_reports_intel_id_idx"
    ON "intel_reports"("intel_id");

ALTER TABLE "intel_reports"
    ADD CONSTRAINT "intel_reports_intel_id_fkey"
    FOREIGN KEY ("intel_id") REFERENCES "intel_alerts"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "intel_reports"
    ADD CONSTRAINT "intel_reports_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
