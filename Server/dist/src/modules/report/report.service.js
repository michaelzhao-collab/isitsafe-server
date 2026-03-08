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
exports.ReportService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const client_1 = require("@prisma/client");
let ReportService = class ReportService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(userId, type, content, relatedQueryId) {
        return this.prisma.report.create({
            data: { userId: userId ?? undefined, type, content, relatedQueryId },
        });
    }
    async list(page = 1, pageSize = 20, status) {
        const skip = (page - 1) * pageSize;
        const where = status ? { status } : {};
        const [items, total] = await Promise.all([
            this.prisma.report.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { createdAt: 'desc' },
                include: { user: { select: { id: true, phone: true, email: true } } },
            }),
            this.prisma.report.count({ where }),
        ]);
        return { items, total, page, pageSize };
    }
    async updateStatus(id, status, handledBy) {
        return this.prisma.report.update({
            where: { id },
            data: { status, handledBy, handledAt: new Date() },
        });
    }
    async getStats() {
        const [pending, handled, rejected] = await Promise.all([
            this.prisma.report.count({ where: { status: client_1.ReportStatus.PENDING } }),
            this.prisma.report.count({ where: { status: client_1.ReportStatus.HANDLED } }),
            this.prisma.report.count({ where: { status: client_1.ReportStatus.REJECTED } }),
        ]);
        return { pending, handled, rejected, total: pending + handled + rejected };
    }
};
exports.ReportService = ReportService;
exports.ReportService = ReportService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ReportService);
//# sourceMappingURL=report.service.js.map