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
exports.AdminMembershipController = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const admin_role_guard_1 = require("../../common/guards/admin-role.guard");
let AdminMembershipController = class AdminMembershipController {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list() {
        return this.prisma.membershipPlan.findMany({
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        });
    }
    async create(body) {
        const plan = await this.prisma.membershipPlan.create({
            data: {
                name: body.name,
                productId: body.productId,
                price: body.price,
                currency: body.currency ?? 'CNY',
                period: body.period,
                description: body.description ?? null,
                isActive: body.isActive ?? true,
                sortOrder: body.sortOrder ?? 0,
                isRecommended: body.isRecommended ?? false,
            },
        });
        return plan;
    }
    async update(id, body) {
        const data = {};
        if (body.name !== undefined)
            data.name = body.name;
        if (body.productId !== undefined)
            data.productId = body.productId;
        if (body.price !== undefined)
            data.price = body.price;
        if (body.currency !== undefined)
            data.currency = body.currency;
        if (body.period !== undefined)
            data.period = body.period;
        if (body.description !== undefined)
            data.description = body.description;
        if (body.isActive !== undefined)
            data.isActive = body.isActive;
        if (body.sortOrder !== undefined)
            data.sortOrder = body.sortOrder;
        if (body.isRecommended !== undefined)
            data.isRecommended = body.isRecommended;
        return this.prisma.membershipPlan.update({
            where: { id },
            data: data,
        });
    }
    async delete(id) {
        await this.prisma.membershipPlan.delete({ where: { id } });
        return { success: true };
    }
};
exports.AdminMembershipController = AdminMembershipController;
__decorate([
    (0, common_1.Get)('plans'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminMembershipController.prototype, "list", null);
__decorate([
    (0, common_1.Post)('plans'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminMembershipController.prototype, "create", null);
__decorate([
    (0, common_1.Put)('plans/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminMembershipController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)('plans/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminMembershipController.prototype, "delete", null);
exports.AdminMembershipController = AdminMembershipController = __decorate([
    (0, common_1.Controller)('admin/membership'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, admin_role_guard_1.AdminRoleGuard),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminMembershipController);
//# sourceMappingURL=admin-membership.controller.js.map