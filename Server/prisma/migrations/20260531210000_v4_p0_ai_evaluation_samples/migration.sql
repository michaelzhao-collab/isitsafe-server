-- V4-P0 AI 分析评测样本表
-- 用途：建立 baseline → 灰度新 prompt → 影子模式对比 → 数据驱动决策

CREATE TABLE "ai_evaluation_samples" (
  "id" TEXT NOT NULL,
  "conversation_id" TEXT,
  "user_id" TEXT,
  "input_content" TEXT NOT NULL,
  "input_type" VARCHAR(20) NOT NULL,
  "language" VARCHAR(10) NOT NULL,
  "prompt_snapshot" JSONB NOT NULL,
  "ai_raw_response" TEXT NOT NULL,
  "parsed_result" JSONB NOT NULL,
  "intent" VARCHAR(30),
  "intent_via" VARCHAR(20),
  "prompt_version" VARCHAR(40) NOT NULL DEFAULT 'baseline',
  "user_shared_to_family" BOOLEAN,
  "user_dismissed" BOOLEAN,
  "admin_score" INTEGER,
  "admin_label" VARCHAR(200),
  "admin_notes" TEXT,
  "scored_by_user_id" TEXT,
  "scored_at" TIMESTAMP(3),
  "model_provider" VARCHAR(30) NOT NULL,
  "latency_ms" INTEGER NOT NULL,
  "tokens_used" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_evaluation_samples_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_evaluation_samples_created_at_idx"
  ON "ai_evaluation_samples" ("created_at" DESC);
CREATE INDEX "ai_evaluation_samples_prompt_version_created_at_idx"
  ON "ai_evaluation_samples" ("prompt_version", "created_at");
CREATE INDEX "ai_evaluation_samples_admin_score_idx"
  ON "ai_evaluation_samples" ("admin_score");
CREATE INDEX "ai_evaluation_samples_intent_created_at_idx"
  ON "ai_evaluation_samples" ("intent", "created_at");
