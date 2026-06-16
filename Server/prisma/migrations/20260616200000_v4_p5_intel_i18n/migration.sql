-- V4-P5 情报双语翻译表
-- 业主需求：抓到中文翻成英文，抓到英文翻成中文，两端用户都能看完整 feed

CREATE TABLE "intel_alert_i18n" (
    "id" TEXT NOT NULL,
    "intel_id" TEXT NOT NULL,
    "language" VARCHAR(10) NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "content_blocks" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intel_alert_i18n_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "intel_alert_i18n_intel_id_language_key"
    ON "intel_alert_i18n"("intel_id", "language");

CREATE INDEX "intel_alert_i18n_language_idx"
    ON "intel_alert_i18n"("language");

ALTER TABLE "intel_alert_i18n"
    ADD CONSTRAINT "intel_alert_i18n_intel_id_fkey"
    FOREIGN KEY ("intel_id") REFERENCES "intel_alerts"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
