-- V3-F 真实 HIBP 集成需要：保存可解密的邮箱密文（AES-GCM + env key）
-- 影响：纯加字段，零回归
ALTER TABLE "breach_targets"
  ADD COLUMN IF NOT EXISTS "target_value_encrypted" TEXT;
