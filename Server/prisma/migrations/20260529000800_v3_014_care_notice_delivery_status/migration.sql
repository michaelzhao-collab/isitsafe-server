-- =====================================================
-- V3-014 family_care_notices 增加投递状态字段（S4-4）
--
-- 问题：现有 notice 表只记录"什么时候推了什么 channel"，但没记送达成败。
--   - 用户关了通知 → push 全失败但服务端不知道
--   - 必须等 daysInactive >= 3 才走 SMS 兜底 → 用户实际已经"失联"很久
--
-- 修复：加 delivery_status JSONB，结构：
--   {
--     "pushDelivered": 0..N,
--     "pushFailed": 0..N,
--     "smsDelivered": 0..N,
--     "smsFailed": 0..N,
--     "escalatedToSms": true/false  // 仅用 2 天 push 全失败时强制升级 SMS 时为 true
--   }
--
-- 业务侧：
--   - 第 2 天 push 全失败 → 直接也走一次 SMS（escalatedToSms=true）
--   - 第 3 天逻辑不变（push + SMS 双发）
-- =====================================================

ALTER TABLE "family_care_notices"
  ADD COLUMN "delivery_status" JSONB;
