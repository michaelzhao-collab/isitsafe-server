-- =====================================================
-- V3-010 user_activities 加 trigger_sources（区分主动 vs push 唤起）
--
-- 背景：
--   PRD"用户真实主动打开 App 才算活跃；仅 push 被点击但无后续动作不算"
--   现有代码无法区分 heartbeat 来源。S2-1 加 trigger_sources JSONB 字段
--   按日累加去重，关怀机制可用它精细化判定。
--
-- 一期 iOS 实际只上报 cold_launch / foreground 两种（push_tap 无对应触发点），
-- 字段设计为数组是为了后续扩展（universal_link / share_extension / siri 等）。
-- =====================================================

ALTER TABLE "user_activities"
  ADD COLUMN "trigger_sources" JSONB NOT NULL DEFAULT '[]'::jsonb;
