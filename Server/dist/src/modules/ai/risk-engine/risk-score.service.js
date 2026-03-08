"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var RiskScoreService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskScoreService = void 0;
const common_1 = require("@nestjs/common");
const DB_SCORE = { high: 90, medium: 50, low: 20 };
const RAG_HIT_SCORE = 5;
const RAG_MAX = 30;
let RiskScoreService = RiskScoreService_1 = class RiskScoreService {
    aiToScore(riskLevel, confidence) {
        const base = { high: 85, medium: 55, low: 25, unknown: 40 }[riskLevel.toLowerCase()] ?? 40;
        return Math.round((base * 0.5 + (confidence / 100) * 50));
    }
    dbToScore(riskLevel) {
        if (!riskLevel)
            return 0;
        return DB_SCORE[riskLevel.toLowerCase()] ?? 0;
    }
    ragToScore(hits) {
        const s = Math.min(hits.length * RAG_HIT_SCORE, RAG_MAX);
        return s;
    }
    compute(aiLevel, confidence, dbHit, ragHits) {
        const aiScore = this.aiToScore(aiLevel, confidence);
        const dbScore = this.dbToScore(dbHit?.riskLevel ?? null);
        const ragScore = this.ragToScore(ragHits);
        let score = Math.round(aiScore * 0.6 + dbScore * 0.3 + ragScore * 0.1);
        if (dbHit)
            score = Math.min(100, score + RiskScoreService_1.RISK_BOOST_WHEN_DB_HIT);
        if (aiLevel === 'unknown' && !dbHit) {
            return { score, risk_level: 'unknown' };
        }
        if (score >= 80)
            return { score, risk_level: 'high' };
        if (score >= 50)
            return { score, risk_level: 'medium' };
        return { score, risk_level: 'low' };
    }
};
exports.RiskScoreService = RiskScoreService;
RiskScoreService.RISK_BOOST_WHEN_DB_HIT = 30;
exports.RiskScoreService = RiskScoreService = RiskScoreService_1 = __decorate([
    (0, common_1.Injectable)()
], RiskScoreService);
//# sourceMappingURL=risk-score.service.js.map