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
exports.QueryService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const redis_service_1 = require("../../redis/redis.service");
const CACHE_PREFIX = 'query:';
const CACHE_TTL = 3600;
let QueryService = class QueryService {
    constructor(prisma, redis) {
        this.prisma = prisma;
        this.redis = redis;
    }
    cacheKey(type, content) {
        return `${CACHE_PREFIX}${type}:${content}`;
    }
    async queryPhone(phone, userId) {
        const cached = await this.redis.get(this.cacheKey('phone', phone));
        if (cached)
            return JSON.parse(cached);
        const items = await this.prisma.riskData.findMany({
            where: { type: 'phone', content: { contains: phone, mode: 'insensitive' } },
            take: 20,
        });
        const result = {
            risk_level: items.length ? items[0].riskLevel : 'low',
            tags: items.flatMap((i) => (Array.isArray(i.tags) ? i.tags : [])),
            records: items,
        };
        await this.redis.set(this.cacheKey('phone', phone), JSON.stringify(result), CACHE_TTL);
        return result;
    }
    async queryUrl(url, userId) {
        const cached = await this.redis.get(this.cacheKey('url', url));
        if (cached)
            return JSON.parse(cached);
        const items = await this.prisma.riskData.findMany({
            where: { type: 'url', content: { contains: url, mode: 'insensitive' } },
            take: 20,
        });
        const result = {
            risk_level: items.length ? items[0].riskLevel : 'low',
            tags: items.flatMap((i) => (Array.isArray(i.tags) ? i.tags : [])),
            records: items,
        };
        await this.redis.set(this.cacheKey('url', url), JSON.stringify(result), CACHE_TTL);
        return result;
    }
    async queryCompany(name, userId) {
        const cached = await this.redis.get(this.cacheKey('company', name));
        if (cached)
            return JSON.parse(cached);
        const items = await this.prisma.riskData.findMany({
            where: { type: 'company', content: { contains: name, mode: 'insensitive' } },
            take: 20,
        });
        const result = {
            risk_level: items.length ? items[0].riskLevel : 'low',
            tags: items.flatMap((i) => (Array.isArray(i.tags) ? i.tags : [])),
            records: items,
        };
        await this.redis.set(this.cacheKey('company', name), JSON.stringify(result), CACHE_TTL);
        return result;
    }
    async queryBatch(requests) {
        const results = await Promise.all(requests.map(async (r) => {
            if (r.type === 'phone')
                return this.queryPhone(r.content);
            if (r.type === 'url')
                return this.queryUrl(r.content);
            return this.queryCompany(r.content);
        }));
        return results;
    }
    async getTags() {
        const cached = await this.redis.get(CACHE_PREFIX + 'tags');
        if (cached)
            return JSON.parse(cached);
        const data = await this.prisma.riskData.findMany({ select: { tags: true } });
        const set = new Set();
        data.forEach((d) => {
            const arr = Array.isArray(d.tags) ? d.tags : [];
            arr.forEach((t) => set.add(t));
        });
        const tags = Array.from(set);
        await this.redis.set(CACHE_PREFIX + 'tags', JSON.stringify(tags), CACHE_TTL * 24);
        return tags;
    }
};
exports.QueryService = QueryService;
exports.QueryService = QueryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService])
], QueryService);
//# sourceMappingURL=query.service.js.map