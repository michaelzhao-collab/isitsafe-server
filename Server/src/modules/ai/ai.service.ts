/**
 * 核心 AI 引擎流程（严格按规范）：
 * Input Parser → Risk DB Check → RAG Keyword Search → AI Model → Risk Score → Cache & Log → Return JSON
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { InputParserService } from './parser/input-parser.service';
import { RiskService } from '../risk/risk.service';
import { RiskScoreService } from './risk-engine/risk-score.service';
import { RagKeywordService } from './rag/rag-keyword.service';
import { AiPromptsService } from './prompts/ai-prompts.service';
import { AiProviderService, AiCallResult } from './providers/ai-provider.service';
import {
  AiOutputSchema,
  parseAndValidateAiOutput,
  RiskLevel,
} from './ai.types';
import { hashForCache } from '../../common/utils/hash';

const CACHE_PREFIX = 'cache:ai:';
const TTL_DEFAULT = 24 * 3600;       // 24h
const TTL_HIGH_RISK = 7 * 24 * 3600; // 7d

export interface AnalyzeInput {
  content: string;
  language?: 'zh' | 'en';
  country?: string;
  isScreenshot?: boolean;
  /** 用户上传截图的 CDN 地址，落库供后台展示 */
  imageUrl?: string;
}

export interface AnalyzeResult extends AiOutputSchema {
  score?: number;
  risk_level: RiskLevel;
}

@Injectable()
export class AiService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private parser: InputParserService,
    private riskService: RiskService,
    private rag: RagKeywordService,
    private prompts: AiPromptsService,
    private provider: AiProviderService,
    private scoreEngine: RiskScoreService,
  ) {}

  /**
   * 主流程：解析 → DB → RAG → AI → 得分 → 缓存 → 写 queries + ai_logs → 返回
   */
  async analyze(
    input: AnalyzeInput,
    userId: string | null,
  ): Promise<AnalyzeResult> {
    const language = input.language ?? 'zh';
    const country = input.country ?? '';
    const isScreenshot = input.isScreenshot ?? false;

    const parsed = this.parser.parse(input.content, isScreenshot);
    const provider = await this.provider.getDefaultProvider();

    const cacheKey = CACHE_PREFIX + hashForCache({
      input_type: parsed.inputType,
      normalized_content: parsed.normalizedContent,
      language,
      country,
      provider,
    });

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        const obj = JSON.parse(cached) as AnalyzeResult;
        await this.writeQuery(userId, parsed, obj, provider, true, input.imageUrl);
        return obj;
      } catch {}
    }

    const dbCheck = await this.riskService.checkRisk(parsed.inputType, parsed.originalContent);
    const dbHit = dbCheck ? { riskLevel: dbCheck.risk_level } : null;
    const keywords = this.rag.keywordExtract(parsed.originalContent);
    const ragCases = await this.rag.searchKnowledgeCases(keywords, 5, language);

    const systemPrompt = this.prompts.buildSystemPrompt(language);
    const userPrompt = this.prompts.buildUserPrompt(
      parsed.originalContent,
      parsed.inputType,
      language,
      ragCases,
      dbCheck?.risk_level ?? null,
    );

    let aiResult: AiCallResult | null = null;
    let parsedAi: AiOutputSchema;
    try {
      aiResult = await this.provider.analyze(userPrompt, systemPrompt, provider);
      parsedAi = parseAndValidateAiOutput(aiResult.raw);
    } catch (e) {
      parsedAi = parseAndValidateAiOutput('');
      await this.logAiCall(provider, null, null, 0, null);
    }

    if (aiResult) {
      await this.logAiCall(
        provider,
        aiResult.model,
        aiResult.tokens,
        aiResult.latencyMs,
        hashForCache({ p: userPrompt.slice(0, 100) }),
      );
    }

    const { score, risk_level } = this.scoreEngine.compute(
      parsedAi.risk_level,
      parsedAi.confidence,
      dbHit,
      ragCases,
    );

    const final: AnalyzeResult = {
      ...parsedAi,
      risk_level,
      score,
    };

    const ttl = risk_level === 'high' ? TTL_HIGH_RISK : TTL_DEFAULT;
    await this.redis.set(cacheKey, JSON.stringify(final), ttl);

    await this.writeQuery(userId, parsed, final, provider, false, input.imageUrl);
    return final;
  }

  private async writeQuery(
    userId: string | null,
    parsed: { inputType: string; normalizedContent: string; originalContent: string },
    result: AnalyzeResult,
    aiProvider: string,
    fromCache: boolean,
    imageUrl?: string,
  ) {
    await this.prisma.query.create({
      data: {
        userId,
        inputType: parsed.inputType,
        content: parsed.originalContent,
        imageUrl: imageUrl ?? null,
        resultJson: result as any,
        riskLevel: result.risk_level,
        confidence: result.confidence,
        aiProvider: fromCache ? null : aiProvider,
      },
    });
  }

  private async logAiCall(
    provider: string,
    model: string | null,
    tokens: number | null,
    latencyMs: number,
    promptHash: string | null,
  ) {
    await this.prisma.aiLog.create({
      data: { provider, model, tokens, latencyMs, promptHash },
    });
  }

  async analyzeScreenshot(
    userId: string | null,
    imageBase64OrText: string,
    language: 'zh' | 'en' = 'zh',
    imageUrl?: string,
  ): Promise<AnalyzeResult> {
    const looksLikeBase64 =
      imageBase64OrText.startsWith('data:image') ||
      /^[A-Za-z0-9+/=]{100,}$/.test(imageBase64OrText.trim());
    if (!looksLikeBase64 && imageBase64OrText.trim().length > 0) {
      return this.analyze(
        { content: imageBase64OrText.trim(), language, isScreenshot: true, imageUrl: imageUrl },
        userId,
      );
    }
    const text = await this.parser.ocrFromImage(imageBase64OrText);
    if (!text?.trim()) {
      return {
        risk_level: 'unknown',
        confidence: 0,
        risk_type: ['未知风险'],
        summary: '暂不支持截图识别，请上传文字或使用客户端 OCR 后传文本',
        reasons: ['服务端 OCR 未启用'],
        advice: ['请手动输入截图中的文字进行分析'],
      };
    }
    return this.analyze(
      { content: text, language, isScreenshot: true, imageUrl },
      userId,
    );
  }
}

