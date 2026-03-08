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
exports.AdminQueriesController = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const admin_role_guard_1 = require("../../common/guards/admin-role.guard");
let AdminQueriesController = class AdminQueriesController {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(page = '1', pageSize = '20', riskLevel, startDate, endDate, includeDeleted) {
        const skip = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
        const where = {};
        if (includeDeleted !== '1')
            where.deletedAt = null;
        if (riskLevel)
            where.riskLevel = riskLevel;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate)
                where.createdAt.gte = new Date(startDate);
            if (endDate)
                where.createdAt.lte = new Date(endDate);
        }
        const [items, total] = await Promise.all([
            this.prisma.query.findMany({
                where,
                skip,
                take: parseInt(pageSize, 10),
                orderBy: { createdAt: 'desc' },
                include: { user: { select: { id: true, phone: true, email: true } } },
            }),
            this.prisma.query.count({ where }),
        ]);
        return { items, total, page: parseInt(page, 10), pageSize: parseInt(pageSize, 10) };
    }
    async get(id) {
        return this.prisma.query.findUniqueOrThrow({
            where: { id },
            include: { user: { select: { id: true, phone: true, email: true } } },
        });
    }
};
exports.AdminQueriesController = AdminQueriesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('pageSize')),
    __param(2, (0, common_1.Query)('riskLevel')),
    __param(3, (0, common_1.Query)('startDate')),
    __param(4, (0, common_1.Query)('endDate')),
    __param(5, (0, common_1.Query)('includeDeleted')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String, String, String]),
    __metadata("design:returntype", Promise)
], AdminQueriesController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminQueriesController.prototype, "get", null);
exports.AdminQueriesController = AdminQueriesController = __decorate([
    (0, common_1.Controller)('admin/queries'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, admin_role_guard_1.AdminRoleGuard),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminQueriesController);
//# sourceMappingURL=admin-queries.controller.js.map