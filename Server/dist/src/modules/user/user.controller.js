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
exports.UserController = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
let UserController = class UserController {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async updateProfile(userId, body) {
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
            where: { id: userId },
            data: data,
        });
        return { success: true };
    }
};
exports.UserController = UserController;
__decorate([
    (0, common_1.Put)('profile'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "updateProfile", null);
exports.UserController = UserController = __decorate([
    (0, common_1.Controller)('user'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UserController);
//# sourceMappingURL=user.controller.js.map