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
exports.MessagesController = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
let MessagesController = class MessagesController {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(userId, page = '1', pageSize = '20') {
        const skip = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
        const messages = await this.prisma.appMessage.findMany({
            orderBy: { createdAt: 'desc' },
            skip,
            take: parseInt(pageSize, 10),
            include: {
                readBy: { where: { userId }, take: 1 },
            },
        });
        const total = await this.prisma.appMessage.count();
        const items = messages.map((m) => ({
            id: m.id,
            title: m.title,
            content: m.content,
            link: m.link,
            createdAt: m.createdAt.toISOString(),
            read: m.readBy.length > 0,
        }));
        return { items, total, page: parseInt(page, 10), pageSize: parseInt(pageSize, 10) };
    }
    async unreadCount(userId) {
        const allIds = await this.prisma.appMessage.findMany({ select: { id: true } });
        const readIds = await this.prisma.userMessageRead.findMany({
            where: { userId },
            select: { messageId: true },
        });
        const readSet = new Set(readIds.map((r) => r.messageId));
        const count = allIds.filter((id) => !readSet.has(id.id)).length;
        return { count };
    }
    async markRead(userId, id) {
        const msg = await this.prisma.appMessage.findUnique({ where: { id } });
        if (!msg)
            return { ok: true };
        await this.prisma.userMessageRead.upsert({
            where: {
                userId_messageId: { userId, messageId: id },
            },
            create: { userId, messageId: id },
            update: {},
        });
        return { ok: true };
    }
};
exports.MessagesController = MessagesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('pageSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], MessagesController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('unread-count'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('sub')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MessagesController.prototype, "unreadCount", null);
__decorate([
    (0, common_1.Post)(':id/read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], MessagesController.prototype, "markRead", null);
exports.MessagesController = MessagesController = __decorate([
    (0, common_1.Controller)('messages'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], MessagesController);
//# sourceMappingURL=messages.controller.js.map