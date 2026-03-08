import { RiskLevel } from '../ai.types';
import type { KnowledgeCaseHit } from '../rag/rag-keyword.service';
export declare class RiskScoreService {
    aiToScore(riskLevel: string, confidence: number): number;
    dbToScore(riskLevel: string | null): number;
    ragToScore(hits: KnowledgeCaseHit[]): number;
    private static readonly RISK_BOOST_WHEN_DB_HIT;
    compute(aiLevel: string, confidence: number, dbHit: {
        riskLevel: string;
    } | null, ragHits: KnowledgeCaseHit[]): {
        score: number;
        risk_level: RiskLevel;
    };
}
