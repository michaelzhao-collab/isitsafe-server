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
exports.MembershipService = void 0;
exports.isPremium = isPremium;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
function isPremium(user) {
    if (!user?.subscriptionExpire)
        return false;
    return new Date(user.subscriptionExpire) > new Date();
}
let MembershipService = class MembershipService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getActivePlans() {
        return this.prisma.membershipPlan.findMany({
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
            select: {
                name: true,
                productId: true,
                price: true,
                currency: true,
                period: true,
                isRecommended: true,
            },
        });
    }
    async isPremiumByUserId(userId) {
        if (!userId)
            return false;
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { subscriptionExpire: true },
        });
        return isPremium(user);
    }
};
exports.MembershipService = MembershipService;
exports.MembershipService = MembershipService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], MembershipService);
//# sourceMappingURL=membership.service.js.map