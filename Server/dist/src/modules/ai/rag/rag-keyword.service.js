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
exports.RagKeywordService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../prisma/prisma.service");
let RagKeywordService = class RagKeywordService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    keywordExtract(content) {
        if (!content?.trim())
            return [];
        const raw = content.replace(/[\s,，。！？、；]+/g, ' ').trim().split(/\s+/);
        const words = raw.filter((w) => w.length >= 2).slice(0, 10);
        return [...new Set(words)];
    }
    async searchKnowledgeCases(keywords, topK = 5, language = 'zh') {
        if (keywords.length === 0)
            return [];
        const cases = await this.prisma.knowledgeCase.findMany({
            where: { language },
            take: topK * 3,
        });
        const scored = cases.map((c) => {
            const tags = c.tags || [];
            let score = 0;
            const contentLower = (c.content || '').toLowerCase();
            const titleLower = (c.title || '').toLowerCase();
            for (const kw of keywords) {
                const k = kw.toLowerCase();
                if (titleLower.includes(k))
                    score += 3;
                if (contentLower.includes(k))
                    score += 2;
                if (tags.some((t) => t.toLowerCase().includes(k)))
                    score += 2;
            }
            return { ...c, tags, score };
        });
        return scored
            .filter((s) => s.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, topK)
            .map(({ id, title, category, content, tags, language, score }) => ({
            id,
            title,
            category,
            content: content.slice(0, 500),
            tags,
            language,
            score,
        }));
    }
};
exports.RagKeywordService = RagKeywordService;
exports.RagKeywordService = RagKeywordService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], RagKeywordService);
//# sourceMappingURL=rag-keyword.service.js.map