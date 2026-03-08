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
exports.AiRateLimitGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const redis_service_1 = require("../../redis/redis.service");
const membership_service_1 = require("../../modules/membership/membership.service");
const public_decorator_1 = require("../decorators/public.decorator");
const PREFIX_MINUTE = 'rate:ai:';
const PREFIX_DAY = 'ai:query:';
const TTL_MINUTE = 60;
const MAX_PER_MINUTE = 20;
const MAX_FREE_PER_DAY = 5;
function dateKey() {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
let AiRateLimitGuard = class AiRateLimitGuard {
    constructor(redis, reflector, membership) {
        this.redis = redis;
        this.reflector = reflector;
        this.membership = membership;
    }
    async canActivate(context) {
        const isPublic = this.reflector.getAllAndOverride(public_decorator_1.IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic)
            return true;
        const request = context.switchToHttp().getRequest();
        const userId = request.user?.sub;
        const ip = request.ip || request.connection?.remoteAddress || 'unknown';
        const client = this.redis.getClient();
        const minuteKey = `${PREFIX_MINUTE}${userId ?? ip}`;
        const minuteCount = await client.incr(minuteKey);
        if (minuteCount === 1)
            await client.expire(minuteKey, TTL_MINUTE);
        if (minuteCount > MAX_PER_MINUTE) {
            throw new common_1.HttpException({ message: 'AI 分析请求过于频繁，请稍后再试' }, common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
        const dayIdentifier = userId ? `u:${userId}` : `ip:${ip}`;
        const dayKey = `${PREFIX_DAY}${dayIdentifier}:${dateKey()}`;
        const isPremium = userId ? await this.membership.isPremiumByUserId(userId) : false;
        if (!isPremium) {
            const dayCount = await client.incr(dayKey);
            if (dayCount === 1)
                await client.expire(dayKey, 86400 * 2);
            if (dayCount > MAX_FREE_PER_DAY) {
                throw new common_1.HttpException({ message: '今日免费次数已用完，开通会员可无限使用' }, common_1.HttpStatus.TOO_MANY_REQUESTS);
            }
        }
        return true;
    }
};
exports.AiRateLimitGuard = AiRateLimitGuard;
exports.AiRateLimitGuard = AiRateLimitGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_1.RedisService,
        core_1.Reflector,
        membership_service_1.MembershipService])
], AiRateLimitGuard);
//# sourceMappingURL=ai-rate-limit.guard.js.map