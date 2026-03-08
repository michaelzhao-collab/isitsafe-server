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
exports.SubscriptionService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
function planTypeFromProductId(productId) {
    const id = (productId || '').toLowerCase();
    if (id.includes('week'))
        return 'weekly';
    if (id.includes('year'))
        return 'yearly';
    return 'monthly';
}
function computeExpireTime(productId) {
    const now = new Date();
    const plan = planTypeFromProductId(productId);
    const exp = new Date(now);
    if (plan === 'weekly')
        exp.setDate(exp.getDate() + 7);
    else if (plan === 'yearly')
        exp.setFullYear(exp.getFullYear() + 1);
    else
        exp.setMonth(exp.getMonth() + 1);
    return exp;
}
let SubscriptionService = class SubscriptionService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async verify(userId, productId, receipt, paymentMethod, transactionId) {
        const expireTime = computeExpireTime(productId);
        const planType = planTypeFromProductId(productId);
        const historyLog = [{ at: new Date().toISOString(), action: 'verify', productId, receipt: receipt.slice(0, 20) }];
        let sub = await this.prisma.subscription.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
        if (sub) {
            sub = await this.prisma.subscription.update({
                where: { id: sub.id },
                data: {
                    productId,
                    planType,
                    status: 'active',
                    expireTime,
                    transactionId: transactionId ?? undefined,
                    historyLog: historyLog,
                    paymentMethod,
                },
            });
        }
        else {
            sub = await this.prisma.subscription.create({
                data: {
                    userId,
                    productId,
                    planType,
                    status: 'active',
                    expireTime,
                    transactionId: transactionId ?? undefined,
                    historyLog: historyLog,
                    paymentMethod,
                },
            });
        }
        await this.prisma.user.update({
            where: { id: userId },
            data: { subscriptionStatus: 'premium', subscriptionExpire: expireTime },
        });
        return { success: true, subscription: sub };
    }
    async getStatus(userId) {
        const sub = await this.prisma.subscription.findFirst({
            where: { userId },
            orderBy: { expireTime: 'desc' },
        });
        if (!sub)
            return {
                active: false,
                expireTime: null,
                productId: null,
                status: null,
                isPremium: false,
                planType: null,
            };
        const active = sub.status === 'active' && sub.expireTime > new Date();
        const isPremium = active;
        return {
            active,
            expireTime: sub.expireTime,
            productId: sub.productId,
            status: sub.status,
            isPremium,
            planType: sub.planType,
        };
    }
    async refresh(userId) {
        const sub = await this.prisma.subscription.findFirst({
            where: { userId },
            orderBy: { expireTime: 'desc' },
        });
        if (!sub)
            return { active: false, expireTime: null, productId: null, status: null };
        const active = sub.status === 'active' && sub.expireTime > new Date();
        if (!active && sub.status === 'active') {
            await this.prisma.subscription.update({
                where: { id: sub.id },
                data: { status: 'expired' },
            });
        }
        return this.getStatus(userId);
    }
    async getLogs(limit = 100) {
        return this.prisma.subscription.findMany({
            orderBy: { updatedAt: 'desc' },
            take: limit,
            include: { user: { select: { id: true, phone: true, email: true, country: true } } },
        });
    }
};
exports.SubscriptionService = SubscriptionService;
exports.SubscriptionService = SubscriptionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SubscriptionService);
//# sourceMappingURL=subscription.service.js.map