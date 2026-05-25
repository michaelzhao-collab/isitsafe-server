-- 接入 DeepSeek 作为备用 AI 提供商
ALTER TABLE "settings"
  ADD COLUMN IF NOT EXISTS "fallback_provider" TEXT,
  ADD COLUMN IF NOT EXISTS "deepseek_key" TEXT;
