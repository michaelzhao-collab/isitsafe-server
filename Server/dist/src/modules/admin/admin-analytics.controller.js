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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminAnalyticsController = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const admin_role_guard_1 = require("../../common/guards/admin-role.guard");
let AdminAnalyticsController = class AdminAnalyticsController {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async stats(startDate, endDate) {
        const where = {};
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate)
                where.createdAt.gte = new Date(startDate);
            if (endDate)
                where.createdAt.lte = new Date(endDate);
        }
        const [totalQueries, highRiskCount, aiLogsTotal, byProvider] = await Promise.all([
            this.prisma.query.count({ where }),
            this.prisma.query.count({ where: { ...where, riskLevel: 'high' } }),
            this.prisma.aiLog.count({ where }),
            this.prisma.aiLog.groupBy({ by: ['provider'], where, _count: true }),
        ]);
        return {
            totalQueries,
            highRiskCount,
            aiLogsTotal,
            byProvider,
        };
    }
    async logs(page = '1', pageSize = '20', startDate, endDate) {
        const where = {};
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate)
                where.createdAt.gte = new Date(startDate);
            if (endDate)
                where.createdAt.lte = new Date(endDate);
        }
        const skip = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
        const [items, total] = await Promise.all([
            this.prisma.aiLog.findMany({
                where,
                skip,
                take: parseInt(pageSize, 10),
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.aiLog.count({ where }),
        ]);
        return { items, total, page: parseInt(page, 10), pageSize: parseInt(pageSize, 10) };
    }
};
exports.AdminAnalyticsController = AdminAnalyticsController;
__decorate([
    (0, common_1.Get)('stats'),
    __param(0, (0, common_1.Query)('startDate')),
    __param(1, (0, common_1.Query)('endDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AdminAnalyticsController.prototype, "stats", null);
__decorate([
    (0, common_1.Get)('logs'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('pageSize')),
    __param(2, (0, common_1.Query)('startDate')),
    __param(3, (0, common_1.Query)('endDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String]),
    __metadata("design:returntype", Promise)
], AdminAnalyticsController.prototype, "logs", null);
exports.AdminAnalyticsController = AdminAnalyticsController = __decorate([
    (0, common_1.Controller)('admin/ai'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, admin_role_guard_1.AdminRoleGuard),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminAnalyticsController);
//# sourceMappingURL=admin-analytics.controller.js.map