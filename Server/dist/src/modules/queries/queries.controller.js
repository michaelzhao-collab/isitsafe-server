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
exports.QueriesController = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const optional_jwt_guard_1 = require("../../common/guards/optional-jwt.guard");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
let QueriesController = class QueriesController {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(userId, page = '1', pageSize = '20', riskLevel) {
        const where = { deletedAt: null };
        if (userId)
            where.userId = userId;
        if (riskLevel)
            where.riskLevel = riskLevel;
        const skip = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
        const [items, total] = await Promise.all([
            this.prisma.query.findMany({
                where,
                skip,
                take: parseInt(pageSize, 10),
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.query.count({ where }),
        ]);
        return { items, total, page: parseInt(page, 10), pageSize: parseInt(pageSize, 10) };
    }
    async delete(userId, id) {
        await this.prisma.query.updateMany({
            where: { id, userId },
            data: { deletedAt: new Date() },
        });
        return {};
    }
};
exports.QueriesController = QueriesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('pageSize')),
    __param(3, (0, common_1.Query)('riskLevel')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, String]),
    __metadata("design:returntype", Promise)
], QueriesController.prototype, "list", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], QueriesController.prototype, "delete", null);
exports.QueriesController = QueriesController = __decorate([
    (0, common_1.Controller)('queries'),
    (0, common_1.UseGuards)(optional_jwt_guard_1.OptionalJwtAuthGuard),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], QueriesController);
//# sourceMappingURL=queries.controller.js.map