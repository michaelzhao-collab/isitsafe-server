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
exports.AiProviderService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = require("axios");
const settings_service_1 = require("../../settings/settings.service");
let AiProviderService = class AiProviderService {
    constructor(config, settings) {
        this.config = config;
        this.settings = settings;
    }
    async getDefaultProvider() {
        return this.settings.getDefaultProvider();
    }
    async getDoubaoConfig() {
        const key = await this.settings.getDoubaoKey() ?? this.config.get('DOUBAO_API_KEY');
        const baseUrl = await this.settings.getAiBaseUrl() ?? this.config.get('DOUBAO_API_URL', 'https://ark.cn-beijing.volces.com/api/v3');
        return { apiKey: key, baseUrl };
    }
    async getOpenAIConfig() {
        const key = await this.settings.getOpenaiKey() ?? this.config.get('OPENAI_API_KEY');
        const baseUrl = await this.settings.getAiBaseUrl() ?? this.config.get('OPENAI_API_URL', 'https://api.openai.com/v1');
        return { apiKey: key, baseUrl };
    }
    async analyzeWithDoubao(prompt, systemPrompt) {
        const { apiKey, baseUrl } = await this.getDoubaoConfig();
        if (!apiKey)
            throw new Error('DOUBAO_API_KEY not configured');
        const start = Date.now();
        const res = await axios_1.default.post(`${baseUrl}/chat/completions`, {
            model: this.config.get('DOUBAO_MODEL', 'doubao-pro-32k'),
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt },
            ],
            temperature: 0.3,
        }, {
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            timeout: 30000,
        });
        const content = res.data?.choices?.[0]?.message?.content;
        const usage = res.data?.usage;
        if (!content)
            throw new Error('Invalid Doubao response');
        return {
            raw: content,
            provider: 'doubao',
            model: res.data?.model ?? 'doubao-pro',
            tokens: usage?.total_tokens ?? null,
            latencyMs: Date.now() - start,
        };
    }
    async analyzeWithOpenAI(prompt, systemPrompt) {
        const { apiKey, baseUrl } = await this.getOpenAIConfig();
        if (!apiKey)
            throw new Error('OPENAI_API_KEY not configured');
        const start = Date.now();
        const res = await axios_1.default.post(`${baseUrl}/chat/completions`, {
            model: this.config.get('OPENAI_MODEL', 'gpt-4o-mini'),
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt },
            ],
            temperature: 0.3,
        }, {
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            timeout: 30000,
        });
        const content = res.data?.choices?.[0]?.message?.content;
        const usage = res.data?.usage;
        if (!content)
            throw new Error('Invalid OpenAI response');
        return {
            raw: content,
            provider: 'openai',
            model: res.data?.model ?? 'gpt-4o-mini',
            tokens: usage?.total_tokens ?? null,
            latencyMs: Date.now() - start,
        };
    }
    async analyzeWithOther(_prompt, _systemPrompt) {
        throw new Error('AI provider "other" not implemented yet');
    }
    async analyze(prompt, systemPrompt, provider) {
        const p = provider ?? (await this.getDefaultProvider());
        if (p === 'openai')
            return this.analyzeWithOpenAI(prompt, systemPrompt);
        if (p === 'other')
            return this.analyzeWithOther(prompt, systemPrompt);
        return this.analyzeWithDoubao(prompt, systemPrompt);
    }
};
exports.AiProviderService = AiProviderService;
exports.AiProviderService = AiProviderService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        settings_service_1.SettingsService])
], AiProviderService);
//# sourceMappingURL=ai-provider.service.js.map