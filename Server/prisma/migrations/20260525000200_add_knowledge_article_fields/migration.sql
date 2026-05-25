-- 防诈案例升级为文章：支持结构化富文本（TipTap JSON）+ 封面图
ALTER TABLE "knowledge_cases"
  ADD COLUMN IF NOT EXISTS "content_blocks" JSONB,
  ADD COLUMN IF NOT EXISTS "cover_image" TEXT;
