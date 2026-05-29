-- =====================================================
-- V3-011 user 加 COPPA / 未成年人合规字段
--
-- 背景：
--   PRD 风控章节提到"家庭组 ward 可未成年"和 COPPA/GDPR 兼容，但代码层
--   完全无相关字段。S3-3 加：
--     - is_minor: 是否标记为未成年（自报或注册时按 birthday 推算）
--     - parent_consent_at: 监护人同意时间戳（NULL = 未获同意；NOT NULL = 已勾选）
--
-- 一期不强制阻断未成年加入，只在加入家庭组时勾选并落审计；后续 S5
-- 可改为：is_minor=true 且 parent_consent_at 为空时直接拒绝兑换。
-- =====================================================

ALTER TABLE "users"
  ADD COLUMN "is_minor" BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE "users"
  ADD COLUMN "parent_consent_at" TIMESTAMP(3);

CREATE INDEX "users_is_minor_idx" ON "users"("is_minor");
