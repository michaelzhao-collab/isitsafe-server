-- V4-P1 冷启动引导 chips
-- admin 后台热更内容；iOS 启动时拉取展示在首条 bot 欢迎气泡下

CREATE TABLE "onboarding_chips" (
  "id" TEXT NOT NULL,
  "order_idx" INTEGER NOT NULL DEFAULT 0,
  "label_zh" VARCHAR(80) NOT NULL,
  "label_en" VARCHAR(120) NOT NULL,
  "icon_type" VARCHAR(40) NOT NULL DEFAULT 'message.fill',
  "action_type" VARCHAR(20) NOT NULL,
  "action_payload_zh" TEXT,
  "action_payload_en" TEXT,
  "status" VARCHAR(20) NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "onboarding_chips_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "onboarding_chips_status_order_idx_idx"
  ON "onboarding_chips" ("status", "order_idx");

-- 默认 4 条 Phase 1 chips
INSERT INTO "onboarding_chips" ("id", "order_idx", "label_zh", "label_en", "icon_type", "action_type", "action_payload_zh", "action_payload_en", "status", "updated_at") VALUES
  (gen_random_uuid()::text, 1,
   '看看这个微信号有没有问题？', 'Check if this WeChat ID is safe?',
   'message.fill', 'text',
   '看看这个微信号有没有问题？', 'Check if this WeChat ID is safe?',
   'active', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 2,
   '派出所打电话查我银行卡，是真的吗？', 'Police calling about my bank card, is it real?',
   'shield.lefthalf.filled', 'text',
   '派出所打电话查我银行卡，是真的吗？', 'Police calling about my bank card, is it real?',
   'active', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 3,
   '群里推荐的内幕投资能信吗？', 'Can I trust the "insider investment" in WeChat group?',
   'chart.line.uptrend.xyaxis', 'text',
   '群里推荐的内幕投资能信吗？', 'Can I trust the "insider investment" in WeChat group?',
   'active', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 4,
   '拍可疑截图给我看', 'Send me a suspicious screenshot',
   'camera.fill', 'image',
   NULL, NULL,
   'active', CURRENT_TIMESTAMP);
