"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const redis_service_1 = require("../../redis/redis.service");
const input_parser_service_1 = require("./parser/input-parser.service");
const risk_service_1 = require("../risk/risk.service");
const risk_score_service_1 = require("./risk-engine/risk-score.service");
const rag_keyword_service_1 = require("./rag/rag-keyword.service");
const ai_prompts_service_1 = require("./prompts/ai-prompts.service");
const ai_provider_service_1 = require("./providers/ai-provider.service");
const ai_types_1 = require("./ai.types");
const hash_1 = require("../../common/utils/hash");
const CACHE_PREFIX = 'cache:ai:';
const TTL_DEFAULT = 24 * 3600;
const TTL_HIGH_RISK = 7 * 24 * 3600;
let AiService = class AiService {
    constructor(prisma, redis, parser, riskService, rag, prompts, provider, scoreEngine) {
        this.prisma = prisma;
        this.redis = redis;
        this.parser = parser;
        this.riskService = riskService;
        this.rag = rag;
        this.prompts = prompts;
        this.provider = provider;
        this.scoreEngine = scoreEngine;
    }
    async analyze(input, userId) {
        const language = input.language ?? 'zh';
        const country = input.country ?? '';
        const isScreenshot = input.isScreenshot ?? false;
        const parsed = this.parser.parse(input.content, isScreenshot);
        const provider = await this.provider.getDefaultProvider();
        const cacheKey = CACHE_PREFIX + (0, hash_1.hashForCache)({
            input_type: parsed.inputType,
            normalized_content: parsed.normalizedContent,
            language,
            country,
            provider,
        });
        const cached = await this.redis.get(cacheKey);
        if (cached) {
            try {
                const obj = JSON.parse(cached);
                await this.writeQuery(userId, parsed, obj, provider, true, input.imageUrl);
                return obj;
            }
            catch { }
        }
        const dbCheck = await this.riskService.checkRisk(parsed.inputType, parsed.originalContent);
        const dbHit = dbCheck ? { riskLevel: dbCheck.risk_level } : null;
        const keywords = this.rag.keywordExtract(parsed.originalContent);
        const ragCases = await this.rag.searchKnowledgeCases(keywords, 5, language);
        const systemPrompt = this.prompts.buildSystemPrompt(language);
        const userPrompt = this.prompts.buildUserPrompt(parsed.originalContent, parsed.inputType, language, ragCases, dbCheck?.risk_level ?? null);
        let aiResult = null;
        let parsedAi;
        try {
            aiResult = await this.provider.analyze(userPrompt, systemPrompt, provider);
            parsedAi = (0, ai_types_1.parseAndValidateAiOutput)(aiResult.raw);
        }
        catch (e) {
            parsedAi = (0, ai_types_1.parseAndValidateAiOutput)('');
            await this.logAiCall(provider, null, null, 0, null);
        }
        if (aiResult) {
            await this.logAiCall(provider, aiResult.model, aiResult.tokens, aiResult.latencyMs, (0, hash_1.hashForCache)({ p: userPrompt.slice(0, 100) }));
        }
        const { score, risk_level } = this.scoreEngine.compute(parsedAi.risk_level, parsedAi.confidence, dbHit, ragCases);
        const final = {
            ...parsedAi,
            risk_level,
            score,
        };
        const ttl = risk_level === 'high' ? TTL_HIGH_RISK : TTL_DEFAULT;
        await this.redis.set(cacheKey, JSON.stringify(final), ttl);
        await this.writeQuery(userId, parsed, final, provider, false, input.imageUrl);
        return final;
    }
    async writeQuery(userId, parsed, result, aiProvider, fromCache, imageUrl) {
        await this.prisma.query.create({
            data: {
                userId,
                inputType: parsed.inputType,
                content: parsed.originalContent,
                imageUrl: imageUrl ?? null,
                resultJson: result,
                riskLevel: result.risk_level,
                confidence: result.confidence,
                aiProvider: fromCache ? null : aiProvider,
            },
        });
    }
    async logAiCall(provider, model, tokens, latencyMs, promptHash) {
        await this.prisma.aiLog.create({
            data: { provider, model, tokens, latencyMs, promptHash },
        });
    }
    async analyzeScreenshot(userId, imageBase64OrText, language = 'zh', imageUrl) {
        const looksLikeBase64 = imageBase64OrText.startsWith('data:image') ||
            /^[A-Za-z0-9+/=]{100,}$/.test(imageBase64OrText.trim());
        if (!looksLikeBase64 && imageBase64OrText.trim().length > 0) {
            return this.analyze({ content: imageBase64OrText.trim(), language, isScreenshot: true, imageUrl: imageUrl }, userId);
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
        return this.analyze({ content: text, language, isScreenshot: true, imageUrl }, userId);
    }
};
exports.AiService = AiService;
exports.AiService = AiService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService,
        input_parser_service_1.InputParserService,
        risk_service_1.RiskService,
        rag_keyword_service_1.RagKeywordService,
        ai_prompts_service_1.AiPromptsService,
        ai_provider_service_1.AiProviderService,
        risk_score_service_1.RiskScoreService])
], AiService);
//# sourceMappingURL=ai.service.js.map