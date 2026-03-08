import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { InputParserService } from './parser/input-parser.service';
import { RiskService } from '../risk/risk.service';
import { RiskScoreService } from './risk-engine/risk-score.service';
import { RagKeywordService } from './rag/rag-keyword.service';
import { AiPromptsService } from './prompts/ai-prompts.service';
import { AiProviderService } from './providers/ai-provider.service';
import { AiOutputSchema, RiskLevel } from './ai.types';
export interface AnalyzeInput {
    content: string;
    language?: 'zh' | 'en';
    country?: string;
    isScreenshot?: boolean;
    imageUrl?: string;
}
export interface AnalyzeResult extends AiOutputSchema {
    score?: number;
    risk_level: RiskLevel;
}
export declare class AiService {
    private prisma;
    private redis;
    private parser;
    private riskService;
    private rag;
    private prompts;
    private provider;
    private scoreEngine;
    constructor(prisma: PrismaService, redis: RedisService, parser: InputParserService, riskService: RiskService, rag: RagKeywordService, prompts: AiPromptsService, provider: AiProviderService, scoreEngine: RiskScoreService);
    analyze(input: AnalyzeInput, userId: string | null): Promise<AnalyzeResult>;
    private writeQuery;
    private logAiCall;
    analyzeScreenshot(userId: string | null, imageBase64OrText: string, language?: 'zh' | 'en', imageUrl?: string): Promise<AnalyzeResult>;
}
