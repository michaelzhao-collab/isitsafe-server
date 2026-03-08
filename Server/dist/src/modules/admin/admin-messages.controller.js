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
exports.AdminMessagesController = exports.CreateMessageDto = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const admin_role_guard_1 = require("../../common/guards/admin-role.guard");
class CreateMessageDto {
}
exports.CreateMessageDto = CreateMessageDto;
let AdminMessagesController = class AdminMessagesController {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(page = '1', pageSize = '20') {
        const skip = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
        const [items, total] = await Promise.all([
            this.prisma.appMessage.findMany({
                orderBy: { createdAt: 'desc' },
                skip,
                take: parseInt(pageSize, 10),
            }),
            this.prisma.appMessage.count(),
        ]);
        return { items, total, page: parseInt(page, 10), pageSize: parseInt(pageSize, 10) };
    }
    async create(dto) {
        const msg = await this.prisma.appMessage.create({
            data: {
                title: dto.title,
                content: dto.content,
                link: dto.link ?? null,
            },
        });
        return msg;
    }
};
exports.AdminMessagesController = AdminMessagesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('pageSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AdminMessagesController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CreateMessageDto]),
    __metadata("design:returntype", Promise)
], AdminMessagesController.prototype, "create", null);
exports.AdminMessagesController = AdminMessagesController = __decorate([
    (0, common_1.Controller)('admin/messages'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, admin_role_guard_1.AdminRoleGuard),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminMessagesController);
//# sourceMappingURL=admin-messages.controller.js.map