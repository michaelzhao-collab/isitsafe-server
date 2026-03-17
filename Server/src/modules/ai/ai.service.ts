/**
 * 核心 AI 引擎流程（严格按规范）：
 * Input Parser → Risk DB Check → RAG Keyword Search → AI Model → Risk Score → Cache & Log → Return JSON
 */
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
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
import { extractUrlFromContent } from '../../common/utils/normalize';
import { QueryService } from '../query/query.service';

const CACHE_PREFIX = 'cache:ai:';
const TTL_DEFAULT = 90 * 24 * 3600;       // 90 天
const TTL_HIGH_RISK = 365 * 24 * 3600;    // 365 天

const FALLBACK_REASONS = ['请结合其他渠道核实', '勿轻信单方说法', '注意保护个人隐私与资金安全'];
const FALLBACK_ADVICE = ['请谨慎对待，勿轻信对方', '可向官方渠道求证', '注意保护个人隐私与资金安全'];

function ensureFullResult(r: AnalyzeResult): AnalyzeResult {
  const reasons = Array.isArray(r.reasons) && r.reasons.length > 0 ? r.reasons : FALLBACK_REASONS;
  const advice = Array.isArray(r.advice) && r.advice.length > 0 ? r.advice : FALLBACK_ADVICE;
  const summary = typeof r.summary === 'string' && r.summary.length > 0 ? r.summary : '暂无总结';
  return { ...r, reasons, advice, summary };
}

function detectLanguageFromContent(text: string): 'zh' | 'en' {
  if (!text) return 'zh';
  // 规则：只要包含任意中文字符，就按中文回答；否则按英文回答
  return /[\u4e00-\u9fff]/.test(text) ? 'zh' : 'en';
}

export interface AnalyzeInput {
  content: string;
  language?: 'zh' | 'en';
  country?: string;
  isScreenshot?: boolean;
  /** 用户上传截图的 CDN 地址，落库供后台展示 */
  imageUrl?: string;
  /** 同一对话内连续提问时传上次返回的 conversation_id，历史按会话只显示一条 */
  conversationId?: string;
}

export interface AnalyzeResult extends AiOutputSchema {
  score?: number;
  risk_level: RiskLevel;
  /** URL 专用：风险库是否命中，供 Admin 与统计 */
  risk_db_hit?: boolean;
  risk_db_hit_level?: string;
  risk_db_hit_record_count?: number;
  /** 当前对话 id，下次同对话提问时传回，历史按会话聚合 */
  conversation_id?: string;
}

@Injectable()
export class AiService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private parser: InputParserService,
    private riskService: RiskService,
    private queryService: QueryService,
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
    const conversationId = (input.conversationId && input.conversationId.trim()) || randomUUID();
    console.log('[AI_FLOW] ========== 开始 AI 分析（会调用豆包） ========== content=' + JSON.stringify(input.content?.slice(0, 300)) + ' conversationId=' + conversationId);
    // 回答语言：按用户提问语言决定（不传则根据内容检测：含中文→中文回答，否则英文回答）
    const language = input.language ?? detectLanguageFromContent(input.content);
    console.log('[AI_FLOW] language=' + language + ' (input.language=' + (input.language ?? 'auto') + ')');
    const country = input.country ?? '';
    const isScreenshot = input.isScreenshot ?? false;

    const parsed = this.parser.parse(input.content, isScreenshot);
    console.log('[AI_FLOW] 1.PARSED inputType=' + parsed.inputType + ' normalizedContent=' + JSON.stringify(parsed.normalizedContent.slice(0, 200)) + ' originalLen=' + parsed.originalContent.length);
    const provider = await this.provider.getDefaultProvider();

    const cacheKey = CACHE_PREFIX + hashForCache({
      input_type: parsed.inputType,
      normalized_content: parsed.normalizedContent,
      language,
      country,
      provider,
    });
    console.log('[AI_FLOW] CACHE_KEY(用于判断是否命中缓存): ' + cacheKey);

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        const obj = ensureFullResult(JSON.parse(cached) as AnalyzeResult);
        console.log('[AI_FLOW] CACHE_HIT 未调豆包，直接使用缓存 risk_level=' + (obj?.risk_level ?? '?'));
        await this.writeQuery(userId, conversationId, parsed, obj, provider, true, input.imageUrl);
        return { ...obj, conversation_id: conversationId };
      } catch {}
    }
    console.log('[AI_FLOW] CACHE_MISS 将调用豆包');

    // URL 专用流程：先查风险库，再按命中/未命中用不同文案调大模型，返回时带 risk_db_hit
    if (parsed.inputType === 'url') {
      const extractedUrl = extractUrlFromContent(parsed.originalContent);
      console.log('[AI_FLOW] URL 风险库匹配前 extractedUrl=' + extractedUrl);
      const urlResult = await this.queryService.queryUrl(extractedUrl);
      const recordCount = urlResult.records?.length ?? 0;
      console.log('[AI_FLOW] URL 风险库匹配后 结果: ' + JSON.stringify({ risk_level: urlResult.risk_level, tags: urlResult.tags, recordsCount: recordCount }));

      const urlSystemPrompt = this.prompts.buildUrlSystemPrompt(language);
      const urlUserPrompt = this.prompts.buildUrlUserPrompt(
        parsed.originalContent,
        extractedUrl,
        { risk_level: urlResult.risk_level, tags: urlResult.tags || [], records: urlResult.records || [] },
        language,
      );
      console.log('[AI_FLOW] URL 调用豆包前 完整参数 systemPromptLen=' + urlSystemPrompt.length + ' userPromptLen=' + urlUserPrompt.length);
      console.log('[AI_FLOW] URL 调用豆包前 SYSTEM_PROMPT_FULL:\n' + urlSystemPrompt);
      console.log('[AI_FLOW] URL 调用豆包前 USER_PROMPT_FULL:\n' + urlUserPrompt);
      let urlAiResult: AiCallResult | null = null;
      let urlParsedAi: AiOutputSchema;
      try {
        urlAiResult = await this.provider.analyze(urlUserPrompt, urlSystemPrompt, provider);
        console.log('[AI_FLOW] URL 豆包返回原始(未解析): ' + (urlAiResult?.raw ?? '(null)'));
        urlParsedAi = parseAndValidateAiOutput(urlAiResult.raw);
        console.log('[AI_FLOW] URL 解析后的完整结果: ' + JSON.stringify(urlParsedAi));
      } catch (e) {
        console.log('[AI_FLOW] URL_AI_CALL_ERROR ' + (e instanceof Error ? e.message : String(e)));
        urlParsedAi = parseAndValidateAiOutput('');
        await this.logAiCall(provider, null, null, 0, null);
      }
      if (urlAiResult) {
        await this.logAiCall(
          provider,
          urlAiResult.model,
          urlAiResult.tokens,
          urlAiResult.latencyMs,
          hashForCache({ p: urlUserPrompt.slice(0, 100) }),
        );
      }
      const dbHit = recordCount > 0 ? { riskLevel: urlResult.risk_level } : null;
      const { score, risk_level } = this.scoreEngine.compute(
        urlParsedAi.risk_level,
        urlParsedAi.confidence,
        dbHit,
        [],
      );
      const urlFinal = ensureFullResult({
        ...urlParsedAi,
        risk_level,
        score,
        risk_db_hit: recordCount > 0,
        risk_db_hit_level: recordCount > 0 ? urlResult.risk_level : undefined,
        risk_db_hit_record_count: recordCount,
      });
      console.log('[AI_FLOW] 6.RESULT URL 最终返回 risk_db_hit=' + urlFinal.risk_db_hit);
      const ttl = risk_level === 'high' ? TTL_HIGH_RISK : TTL_DEFAULT;
      await this.redis.set(cacheKey, JSON.stringify(urlFinal), ttl);
      await this.writeQuery(userId, conversationId, parsed, urlFinal, provider, false, input.imageUrl);
      return { ...urlFinal, conversation_id: conversationId };
    }

    console.log('[AI_FLOW] 2.风险库匹配前 inputType=' + parsed.inputType + ' contentLen=' + parsed.originalContent.length);
    const dbCheck = await this.riskService.checkRisk(parsed.inputType, parsed.originalContent);
    const dbHit = dbCheck ? { riskLevel: dbCheck.risk_level } : null;
    console.log('[AI_FLOW] 2.风险库匹配后 结果: ' + (dbCheck ? JSON.stringify(dbCheck) : 'null'));
    const keywords = this.rag.keywordExtract(parsed.originalContent);
    const ragCases = await this.rag.searchKnowledgeCases(keywords, 5, language);
    console.log('[AI_FLOW] 3.RAG keywords=' + JSON.stringify(keywords) + ' casesCount=' + ragCases.length);

    const systemPrompt = this.prompts.buildSystemPrompt(language);
    const userPrompt = this.prompts.buildUserPrompt(
      parsed.originalContent,
      parsed.inputType,
      language,
      ragCases,
      dbCheck?.risk_level ?? null,
    );

    console.log('[AI_FLOW] 调用豆包前 完整参数 systemPromptLen=' + systemPrompt.length + ' userPromptLen=' + userPrompt.length);
    console.log('[AI_FLOW] 调用豆包前 SYSTEM_PROMPT_FULL:\n' + systemPrompt);
    console.log('[AI_FLOW] 调用豆包前 USER_PROMPT_FULL:\n' + userPrompt);
    let aiResult: AiCallResult | null = null;
    let parsedAi: AiOutputSchema;
    try {
      aiResult = await this.provider.analyze(userPrompt, systemPrompt, provider);
      console.log('[AI_FLOW] 豆包返回原始(未解析): ' + (aiResult?.raw ?? '(null)'));
      parsedAi = parseAndValidateAiOutput(aiResult.raw);
      console.log('[AI_FLOW] 解析后的完整结果: ' + JSON.stringify(parsedAi));
    } catch (e) {
      console.log('[AI_FLOW] 4.AI_CALL_ERROR ' + (e instanceof Error ? e.message : String(e)));
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
    console.log('[AI_FLOW] 5.SCORE_ENGINE AI原始=' + parsedAi.risk_level + ' confidence=' + parsedAi.confidence + ' => score=' + score + ' risk_level=' + risk_level);

    const final = ensureFullResult({
      ...parsedAi,
      risk_level,
      score,
      risk_db_hit: false,
    });
    console.log('[AI_FLOW] 6.RESULT 最终返回 risk_level=' + final.risk_level + ' reasonsLen=' + (final.reasons?.length ?? 0) + ' adviceLen=' + (final.advice?.length ?? 0));

    const ttl = risk_level === 'high' ? TTL_HIGH_RISK : TTL_DEFAULT;
    await this.redis.set(cacheKey, JSON.stringify(final), ttl);

    await this.writeQuery(userId, conversationId, parsed, final, provider, false, input.imageUrl);
    return { ...final, conversation_id: conversationId };
  }

  private async writeQuery(
    userId: string | null,
    conversationId: string,
    parsed: { inputType: string; normalizedContent: string; originalContent: string },
    result: AnalyzeResult,
    aiProvider: string,
    fromCache: boolean,
    imageUrl?: string,
  ) {
    await this.prisma.query.create({
      data: {
        userId,
        conversationId,
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
    language?: 'zh' | 'en',
    imageUrl?: string,
    conversationId?: string,
  ): Promise<AnalyzeResult> {
    const looksLikeBase64 =
      imageBase64OrText.startsWith('data:image') ||
      /^[A-Za-z0-9+/=]{100,}$/.test(imageBase64OrText.trim());
    if (!looksLikeBase64 && imageBase64OrText.trim().length > 0) {
      return this.analyze(
        { content: imageBase64OrText.trim(), language, isScreenshot: true, imageUrl: imageUrl, conversationId },
        userId,
      );
    }
    const text = await this.parser.ocrFromImage(imageBase64OrText);
    if (!text?.trim()) {
      return {
        risk_level: 'unknown',
        confidence: 0,
        risk_type: ['未知风险'],
        summary: '图片内容无法识别',
        reasons: [
          '图片中未识别到可分析文字',
          '当前无法对纯图片内容进行风险分析',
          '可尝试上传包含文字的截图或直接输入文字',
        ],
        advice: [
          '请上传包含文字的图片以便分析',
          '或直接输入您要检测的文字内容',
          '如有疑问可联系客服',
        ],
      };
    }
    return this.analyze(
      { content: text, language, isScreenshot: true, imageUrl, conversationId },
      userId,
    );
  }
}

