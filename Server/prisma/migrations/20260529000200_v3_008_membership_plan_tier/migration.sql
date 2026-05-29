-- =====================================================
-- V3-008 membership_plans 增加 tier 字段
--
-- 背景：V3 一期家庭套餐（owner 付费 → 全员共享）需要在订阅层区分
--   personal | family，避免靠 productId 命名约定散落在业务层。
--
-- 老数据：默认 'personal'，与现有行为一致。
-- =====================================================

ALTER TABLE "membership_plans"
  ADD COLUMN "tier" VARCHAR(20) NOT NULL DEFAULT 'personal';

ALTER TABLE "membership_plans"
  ADD CONSTRAINT "membership_plans_tier_check"
  CHECK ("tier" IN ('personal', 'family'));

CREATE INDEX "membership_plans_tier_is_active_idx"
  ON "membership_plans" ("tier", "is_active");
