-- 创建知识库分类配置表
CREATE TABLE "knowledge_category_config" (
  "id"         TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "key"        VARCHAR(64) NOT NULL,
  "name_zh"    VARCHAR(100) NOT NULL,
  "name_en"    VARCHAR(100) NOT NULL,
  "status"     VARCHAR(20) NOT NULL DEFAULT 'active',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- key 唯一
CREATE UNIQUE INDEX "knowledge_category_config_key_key" ON "knowledge_category_config"("key");

-- status + sort_order 索引（与 Prisma 模型 @@index([status, sortOrder]) 对应）
CREATE INDEX "knowledge_category_config_status_sort_order_idx"
  ON "knowledge_category_config"("status", "sort_order");