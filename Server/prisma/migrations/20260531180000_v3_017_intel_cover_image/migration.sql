-- V3-K intel_alerts 加 cover_image 字段（从 RSS 原文 HTML 抽出来的首张图）

ALTER TABLE "intel_alerts" ADD COLUMN "cover_image" VARCHAR(500);
