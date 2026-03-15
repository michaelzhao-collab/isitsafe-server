/**
 * Risk Score Engine：
 * AI_score + DB_score + RAG_score -> 加权 score -> 映射 risk_level
 * score = AI*0.6 + DB*0.3 + RAG*0.1
 */
import { Injectable } from '@nestjs/common';
import { RiskLevel } from '../ai.types';
import type { KnowledgeCaseHit } from '../rag/rag-keyword.service';

const DB_SCORE = { high: 90, medium: 50, low: 20 } as const;
const RAG_HIT_SCORE = 5;
const RAG_MAX = 30;

@Injectable()
export class RiskScoreService {
  /**
   * AI risk_level + confidence -> 0~100 分
   */
  aiToScore(riskLevel: string, confidence: number): number {
    const base = { high: 85, medium: 55, low: 25, unknown: 40 }[riskLevel.toLowerCase()] ?? 40;
    return Math.round((base * 0.5 + (confidence / 100) * 50));
  }

  /**
   * DB 命中：未命中 0；medium 50；high 90；low 20
   */
  dbToScore(riskLevel: string | null): number {
    if (!riskLevel) return 0;
    return DB_SCORE[riskLevel.toLowerCase() as keyof typeof DB_SCORE] ?? 0;
  }

  /**
   * RAG：命中案例数 * 5，上限 30
   */
  ragToScore(hits: KnowledgeCaseHit[]): number {
    const s = Math.min(hits.length * RAG_HIT_SCORE, RAG_MAX);
    return s;
  }

  /** DB 命中时加分 */
  private static readonly RISK_BOOST_WHEN_DB_HIT = 30;

  /**
   * 综合得分并映射 risk_level
   * 无风险库命中且无 RAG 时：仅依赖 AI，用满额 aiScore，避免“任何内容都低风险”
   * 有 DB 或 RAG 时：score = AI*0.6 + DB*0.3 + RAG*0.1，DB 命中 +30
   * >=80 high; 50-79 medium; <50 low; unknown 且 DB 未命中 -> unknown
   */
  compute(
    aiLevel: string,
    confidence: number,
    dbHit: { riskLevel: string } | null,
    ragHits: KnowledgeCaseHit[],
  ): { score: number; risk_level: RiskLevel } {
    const aiScore = this.aiToScore(aiLevel, confidence);
    const dbScore = this.dbToScore(dbHit?.riskLevel ?? null);
    const ragScore = this.ragToScore(ragHits);

    const hasDbOrRag = !!dbHit || ragHits.length > 0;
    let score: number;
    if (!hasDbOrRag) {
      score = Math.round(aiScore);
    } else {
      score = Math.round(aiScore * 0.6 + dbScore * 0.3 + ragScore * 0.1);
      if (dbHit) score = Math.min(100, score + RiskScoreService.RISK_BOOST_WHEN_DB_HIT);
    }

    if (aiLevel === 'unknown' && !dbHit) {
      return { score, risk_level: 'unknown' };
    }
    if (score >= 80) return { score, risk_level: 'high' };
    if (score >= 50) return { score, risk_level: 'medium' };
    return { score, risk_level: 'low' };
  }
}
