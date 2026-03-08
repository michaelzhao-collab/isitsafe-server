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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../../prisma/prisma.service");
const redis_service_1 = require("../../redis/redis.service");
const LOCK_KEY = 'auth:lock:';
const ATTEMPTS_KEY = 'auth:attempts:';
const REFRESH_PREFIX = 'refresh:';
let AuthService = class AuthService {
    constructor(prisma, redis, jwt, config) {
        this.prisma = prisma;
        this.redis = redis;
        this.jwt = jwt;
        this.config = config;
    }
    get maxAttempts() {
        return parseInt(this.config.get('LOGIN_MAX_ATTEMPTS', '5'), 10);
    }
    get lockMinutes() {
        return parseInt(this.config.get('LOGIN_LOCK_MINUTES', '15'), 10);
    }
    async login(body, ip) {
        if (body.phone) {
            await this.checkLock(body.phone);
            const user = await this.prisma.user.upsert({
                where: { phone: body.phone },
                create: { phone: body.phone, country: 'CN' },
                update: {},
            });
            await this.recordLogin(user.id);
            await this.clearAttempts(body.phone);
            return this.issueTokens(user);
        }
        if (body.email) {
            await this.checkLock(body.email);
            const user = await this.prisma.user.upsert({
                where: { email: body.email },
                create: { email: body.email, country: null },
                update: {},
            });
            await this.recordLogin(user.id);
            await this.clearAttempts(body.email);
            return this.issueTokens(user);
        }
        throw new common_1.UnauthorizedException('请提供 phone 或 email');
    }
    async loginPhone(dto, ip) {
        return this.login({ phone: dto.phone, code: dto.code }, ip);
    }
    async loginEmail(dto, ip) {
        return this.login({ email: dto.email, code: dto.code }, ip);
    }
    async loginSms(dto, ip) {
        return this.login({ phone: dto.phone, smsCode: dto.smsCode }, ip);
    }
    async recordFailedLogin(identifier) {
        const key = ATTEMPTS_KEY + identifier;
        const client = this.redis.getClient();
        const count = await client.incr(key);
        if (count === 1)
            await client.expire(key, this.lockMinutes * 60);
        if (count >= this.maxAttempts) {
            await this.redis.set(LOCK_KEY + identifier, '1', this.lockMinutes * 60);
            throw new common_1.HttpException('Too many failed attempts. Try again later.', common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
    }
    async checkLock(identifier) {
        const locked = await this.redis.get(LOCK_KEY + identifier);
        if (locked)
            throw new common_1.HttpException('Account temporarily locked.', common_1.HttpStatus.TOO_MANY_REQUESTS);
    }
    async clearAttempts(identifier) {
        await this.redis.del(ATTEMPTS_KEY + identifier);
        await this.redis.del(LOCK_KEY + identifier);
    }
    async recordLogin(userId) {
        await this.prisma.user.update({
            where: { id: userId },
            data: { lastLogin: new Date() },
        });
    }
    async issueTokens(user) {
        const payload = { sub: user.id, role: user.role };
        const accessToken = this.jwt.sign(payload);
        const refreshSecret = this.config.get('JWT_REFRESH_SECRET', 'refresh-secret');
        const refreshExpires = this.config.get('JWT_REFRESH_EXPIRES_IN', '30d');
        const refreshToken = this.jwt.sign({ ...payload, type: 'refresh' }, { secret: refreshSecret, expiresIn: refreshExpires });
        await this.redis.set(REFRESH_PREFIX + user.id, refreshToken, 30 * 24 * 3600);
        return {
            accessToken,
            refreshToken,
            expiresIn: 604800,
        };
    }
    async refreshToken(refreshToken) {
        const refreshSecret = this.config.get('JWT_REFRESH_SECRET', 'refresh-secret');
        try {
            const decoded = this.jwt.verify(refreshToken, { secret: refreshSecret });
            if (decoded.type !== 'refresh')
                throw new Error();
            const stored = await this.redis.get(REFRESH_PREFIX + decoded.sub);
            if (stored !== refreshToken)
                throw new common_1.UnauthorizedException('Invalid refresh token');
            const user = await this.prisma.user.findUnique({ where: { id: decoded.sub } });
            if (!user)
                throw new common_1.UnauthorizedException('User not found');
            return this.issueTokens(user);
        }
        catch {
            throw new common_1.UnauthorizedException('Invalid refresh token');
        }
    }
    async logout(userId) {
        await this.redis.del(REFRESH_PREFIX + userId);
        return { success: true };
    }
    async getUserInfo(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
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
            },
        });
        if (!user)
            throw new common_1.UnauthorizedException('User not found');
        const u = user;
        return {
            ...u,
            birthday: u.birthday ? u.birthday.toISOString().slice(0, 10) : null,
            subscriptionExpire: u.subscriptionExpire ? u.subscriptionExpire.toISOString().slice(0, 10) : null,
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService,
        jwt_1.JwtService,
        config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map