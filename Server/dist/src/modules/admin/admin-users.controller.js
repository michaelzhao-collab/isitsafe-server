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
exports.AdminUsersController = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const admin_role_guard_1 = require("../../common/guards/admin-role.guard");
let AdminUsersController = class AdminUsersController {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(page = '1', pageSize = '20', country) {
        const skip = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
        const where = {};
        if (country)
            where.country = country;
        const [items, total] = await Promise.all([
            this.prisma.user.findMany({
                where,
                skip,
                take: parseInt(pageSize, 10),
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    phone: true,
                    email: true,
                    country: true,
                    avatar: true,
                    nickname: true,
                    gender: true,
                    birthday: true,
                    role: true,
                    lastLogin: true,
                    subscriptionStatus: true,
                    subscriptionExpire: true,
                    createdAt: true,
                    subscriptions: { take: 1, orderBy: { expireTime: 'desc' } },
                },
            }),
            this.prisma.user.count({ where }),
        ]);
        const pageNum = parseInt(page, 10);
        const size = parseInt(pageSize, 10);
        const itemsWithBirthday = items.map((u) => ({
            ...u,
            birthday: u.birthday ? u.birthday.toISOString().slice(0, 10) : null,
        }));
        return { items: itemsWithBirthday, total, page: pageNum, pageSize: size };
    }
    async getOne(id) {
        const user = await this.prisma.user.findUniqueOrThrow({
            where: { id },
            select: {
                id: true,
                phone: true,
                email: true,
                country: true,
                avatar: true,
                nickname: true,
                gender: true,
                birthday: true,
                role: true,
                lastLogin: true,
                subscriptionStatus: true,
                subscriptionExpire: true,
                createdAt: true,
                subscriptions: { take: 1, orderBy: { expireTime: 'desc' } },
            },
        });
        const u = user;
        return {
            ...u,
            birthday: u.birthday ? u.birthday.toISOString().slice(0, 10) : null,
        };
    }
    async updateStatus(id, status) {
        return { id, status, success: true };
    }
    async updateUser(id, body) {
        const data = {};
        if (body.avatar !== undefined)
            data.avatar = body.avatar;
        if (body.nickname !== undefined)
            data.nickname = body.nickname;
        if (body.gender !== undefined) {
            const g = body.gender?.toLowerCase();
            data.gender = g === 'male' || g === 'female' ? g : 'unknown';
        }
        if (body.birthday !== undefined) {
            if (body.birthday === null || body.birthday === '') {
                data.birthday = null;
            }
            else {
                const d = new Date(body.birthday);
                if (!isNaN(d.getTime()))
                    data.birthday = d;
            }
        }
        await this.prisma.user.update({
            where: { id },
            data: data,
        });
        return { success: true };
    }
};
exports.AdminUsersController = AdminUsersController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('pageSize')),
    __param(2, (0, common_1.Query)('country')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], AdminUsersController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminUsersController.prototype, "getOne", null);
__decorate([
    (0, common_1.Put)(':id/status'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AdminUsersController.prototype, "updateStatus", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminUsersController.prototype, "updateUser", null);
exports.AdminUsersController = AdminUsersController = __decorate([
    (0, common_1.Controller)('admin/users'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, admin_role_guard_1.AdminRoleGuard),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminUsersController);
//# sourceMappingURL=admin-users.controller.js.map