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
exports.RiskDbService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../prisma/prisma.service");
const normalize_1 = require("../../../common/utils/normalize");
let RiskDbService = class RiskDbService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async check(type, normalizedContent, originalContent) {
        const list = await this.prisma.riskData.findMany({
            where: { type },
            take: 50,
        });
        const norm = normalizedContent.toLowerCase();
        const orig = originalContent.trim().toLowerCase();
        for (const r of list) {
            const rNorm = (0, normalize_1.normalizeContent)(r.content).toLowerCase();
            const rOrig = r.content.trim().toLowerCase();
            if (norm.includes(rNorm) || rNorm.includes(norm) || orig.includes(rOrig) || rOrig.includes(orig)) {
                return {
                    id: r.id,
                    type: r.type,
                    content: r.content,
                    riskLevel: r.riskLevel,
                    riskCategory: r.riskCategory,
                    tags: r.tags,
                };
            }
        }
        return null;
    }
};
exports.RiskDbService = RiskDbService;
exports.RiskDbService = RiskDbService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], RiskDbService);
//# sourceMappingURL=risk-db.service.js.map