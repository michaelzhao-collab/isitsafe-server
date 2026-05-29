import {
  Injectable,
  UnauthorizedException,
  HttpException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { randomUUID, createPublicKey } from 'crypto';
import * as nodeJwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import axios from 'axios';
import { UserRole } from '@prisma/client';
import { GeoIpService } from './geoip.service';
import {
  LoginPhoneDto,
  LoginEmailDto,
  AppleLoginDto,
  SocialLoginDto,
} from './dto/login.dto';

const LOCK_KEY = 'auth:lock:';
const ATTEMPTS_KEY = 'auth:attempts:';
const REFRESH_PREFIX = 'refresh:';
const E164_RE = /^\+[1-9]\d{6,14}$/;

type AppleJwk = {
  kty: string;
  kid: string;
  use: string;
  alg: string;
  n: string;
  e: string;
};

type AppleIdTokenPayload = {
  sub: string;
  email?: string;
  email_verified?: boolean | string;
  nonce?: string;
};

@Injectable()
export class AuthService {
  private appleKeysCache: { at: number; keys: AppleJwk[] } | null = null;
  private ensuredIdentityTable = false;

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private jwt: JwtService,
    private config: ConfigService,
    private geoIp: GeoIpService,
  ) {}

  /**
   * 异步把用户的国家/地区码补齐（country 为空时才补，不覆盖已有值）
   * fire-and-forget：不阻塞登录响应
   */
  private triggerGeoBackfill(userId: string, req?: { headers?: Record<string, any>; ip?: string }) {
    if (!req) return;
    this.geoIp.backfillUserGeo(userId, req).catch(() => {
      // silent: GeoIpService 内部已记日志
    });
  }

  private get maxAttempts() {
    return parseInt(this.config.get('LOGIN_MAX_ATTEMPTS', '5'), 10);
  }

  private get lockMinutes() {
    return parseInt(this.config.get('LOGIN_LOCK_MINUTES', '15'), 10);
  }

  private readonly PASSWORD_MIN_LEN = 8;
  private readonly BCRYPT_ROUNDS = 10;

  private get appleAudience() {
    return (
      this.config.get('APPLE_BUNDLE_ID') ||
      this.config.get('IOS_BUNDLE_ID') ||
      this.config.get('APP_BUNDLE_ID') ||
      ''
    );
  }

  private get appleAutoLinkByEmail() {
    const raw = (this.config.get('APPLE_AUTO_LINK_BY_EMAIL', 'true') || '').toLowerCase();
    return !['0', 'false', 'off', 'no'].includes(raw);
  }

  private get googleLoginEnabled() {
    const raw = (this.config.get('GOOGLE_LOGIN_ENABLED', 'false') || '').toLowerCase();
    return ['1', 'true', 'on', 'yes'].includes(raw);
  }

  /**
   * 统一登录/注册入口：手机号 + 密码（>= 8 位）；新用户自动创建账号。
   * 邮箱登录暂时保留（内部/兜底使用）。
   */
  async login(
    body: { phone?: string; email?: string; password?: string; code?: string; smsCode?: string },
    ip?: string,
  ) {
    if (body.phone) {
      if (!E164_RE.test(body.phone)) {
        throw new BadRequestException('Invalid phone number');
      }
      const password = body.password?.trim() ?? '';
      if (password.length < this.PASSWORD_MIN_LEN) {
        throw new BadRequestException('密码长度不能少于 8 位');
      }

      await this.checkLock(body.phone);

      const existing = await this.prisma.user.findUnique({ where: { phone: body.phone } });

      if (existing) {
        if (existing.passwordHash) {
          // 已有密码：验证
          const ok = await bcrypt.compare(password, existing.passwordHash);
          if (!ok) {
            await this.recordFailedLogin(body.phone);
            throw new BadRequestException('手机号或密码错误');
          }
        } else {
          // 旧版 OTP 账号：首次设置密码
          const hash = await bcrypt.hash(password, this.BCRYPT_ROUNDS);
          await this.prisma.user.update({ where: { id: existing.id }, data: { passwordHash: hash } });
        }
        await this.recordLogin(existing.id);
        await this.clearAttempts(body.phone);
        return this.issueTokens(existing);
      } else {
        // 新用户：创建账号
        const hash = await bcrypt.hash(password, this.BCRYPT_ROUNDS);
        const user = await this.prisma.user.create({
          data: {
            phone: body.phone,
            country: this.countryHintFromE164(body.phone),
            passwordHash: hash,
          },
        });
        await this.recordLogin(user.id);
        await this.clearAttempts(body.phone);
        return this.issueTokens(user);
      }
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
    throw new UnauthorizedException('请提供 phone 或 email');
  }

  async loginPhone(dto: LoginPhoneDto, ip?: string, req?: { headers?: Record<string, any>; ip?: string }) {
    const result = await this.login(
      { phone: dto.phone, password: dto.password, code: dto.code, smsCode: dto.smsCode },
      ip,
    );
    if (result?.userId) this.triggerGeoBackfill(result.userId, req);
    return result;
  }

  async loginEmail(dto: LoginEmailDto, ip?: string, req?: { headers?: Record<string, any>; ip?: string }) {
    const result = await this.login({ email: dto.email, code: dto.code }, ip);
    if (result?.userId) this.triggerGeoBackfill(result.userId, req);
    return result;
  }

  async loginSocial(dto: SocialLoginDto, req?: { headers?: Record<string, any>; ip?: string }) {
    if (dto.provider === 'apple') {
      return this.loginApple(dto, req);
    }
    if (dto.provider === 'google') {
      if (!this.googleLoginEnabled) {
        throw new HttpException('Google login is not enabled', HttpStatus.NOT_IMPLEMENTED);
      }
      // 预留：Google 接入时复用 auth_identities/provider=google
      throw new HttpException('Google login is not implemented yet', HttpStatus.NOT_IMPLEMENTED);
    }
    throw new BadRequestException('Unsupported social provider');
  }

  async loginApple(dto: AppleLoginDto, req?: { headers?: Record<string, any>; ip?: string }) {
    const payload = await this.verifyAppleIdentityToken(dto.identityToken, dto.nonce);
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid Apple identity token');
    }

    await this.ensureAuthIdentityTable();
    const provider = 'apple';
    const providerSub = payload.sub;
    const providerEmail = payload.email ?? null;
    const displayName = dto.displayName?.trim() || null;

    const user = await this.prisma.$transaction(async (tx) => {
      const identityRows = await tx.$queryRaw<{ user_id: string }[]>`
        SELECT user_id
        FROM auth_identities
        WHERE provider = ${provider} AND provider_sub = ${providerSub}
        LIMIT 1
      `;

      let userId = identityRows[0]?.user_id ?? null;
      let user =
        userId != null ? await tx.user.findUnique({ where: { id: userId } }) : null;

      if (!user && providerEmail && this.appleAutoLinkByEmail) {
        user = await tx.user.findUnique({ where: { email: providerEmail } });
      }

      if (!user) {
        user = await tx.user.create({
          data: {
            email: providerEmail,
            nickname: displayName,
          },
        });
      } else if (!user.email && providerEmail) {
        user = await tx.user.update({
          where: { id: user.id },
          data: { email: providerEmail, nickname: user.nickname ?? displayName },
        });
      }

      const identityId = randomUUID();
      await tx.$executeRaw`
        INSERT INTO auth_identities (id, user_id, provider, provider_sub, provider_email, is_verified, created_at, updated_at)
        VALUES (${identityId}, ${user.id}, ${provider}, ${providerSub}, ${providerEmail}, ${true}, NOW(), NOW())
        ON CONFLICT (provider, provider_sub)
        DO UPDATE SET
          provider_email = EXCLUDED.provider_email,
          updated_at = NOW()
      `;
      return user;
    });

    await this.recordLogin(user.id);
    this.triggerGeoBackfill(user.id, req);
    return this.issueTokens(user);
  }

  /** 供客户端默认国家：优先 CDN 提供的国家码（如 Cloudflare），否则 null，由客户端用 Locale / IP 兜底 */
  regionHint(req: { headers?: Record<string, string | string[] | undefined> }) {
    const raw = req.headers?.['cf-ipcountry'];
    const cf = Array.isArray(raw) ? raw[0] : raw;
    if (typeof cf === 'string' && /^[A-Z]{2}$/.test(cf)) {
      return { countryCode: cf };
    }
    return { countryCode: null as string | null };
  }

  private countryHintFromE164(phone: string): string | undefined {
    if (phone.startsWith('+86')) return 'CN';
    if (phone.startsWith('+1')) return 'US';
    if (phone.startsWith('+44')) return 'GB';
    if (phone.startsWith('+81')) return 'JP';
    if (phone.startsWith('+82')) return 'KR';
    return undefined;
  }

  async recordFailedLogin(identifier: string) {
    const key = ATTEMPTS_KEY + identifier;
    const client = this.redis.getClient();
    const count = await client.incr(key);
    if (count === 1) await client.expire(key, this.lockMinutes * 60);
    if (count >= this.maxAttempts) {
      await this.redis.set(LOCK_KEY + identifier, '1', this.lockMinutes * 60);
      throw new HttpException('Too many failed attempts. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private async checkLock(identifier: string) {
    try {
      const locked = await this.redis.get(LOCK_KEY + identifier);
      if (locked) throw new HttpException('Account temporarily locked.', HttpStatus.TOO_MANY_REQUESTS);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      // Redis 不可用时跳过锁检查
    }
  }

  private async clearAttempts(identifier: string) {
    try {
      await this.redis.del(ATTEMPTS_KEY + identifier);
      await this.redis.del(LOCK_KEY + identifier);
    } catch {
      // Redis 不可用时忽略
    }
  }

  private async recordLogin(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLogin: new Date() },
    });
  }

  private async issueTokens(user: { id: string; role: UserRole }) {
    const payload = { sub: user.id, role: user.role };
    const accessToken = this.jwt.sign(payload);
    const refreshSecret = this.config.get('JWT_REFRESH_SECRET', 'refresh-secret');
    const refreshExpires = this.config.get('JWT_REFRESH_EXPIRES_IN', '30d');
    const refreshToken = this.jwt.sign(
      { ...payload, type: 'refresh' },
      { secret: refreshSecret, expiresIn: refreshExpires },
    );
    try {
      await this.redis.set(REFRESH_PREFIX + user.id, refreshToken, 30 * 24 * 3600);
    } catch {
      // Redis 不可用时仍返回 token，仅刷新可能失效
    }
    return {
      accessToken,
      refreshToken,
      expiresIn: 604800, // 7d in seconds
      userId: user.id, // 给调用方拿到 userId 用于后续异步操作（如 geoIp 回填）
    };
  }

  async refreshToken(refreshToken: string) {
    const refreshSecret = this.config.get('JWT_REFRESH_SECRET', 'refresh-secret');
    try {
      const decoded = this.jwt.verify(refreshToken, { secret: refreshSecret }) as { sub: string; type?: string };
      if (decoded.type !== 'refresh') throw new Error();
      const stored = await this.redis.get(REFRESH_PREFIX + decoded.sub);
      if (stored !== refreshToken) throw new UnauthorizedException('Invalid refresh token');
      const user = await this.prisma.user.findUnique({ where: { id: decoded.sub } });
      if (!user) throw new UnauthorizedException('User not found');
      return this.issueTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string) {
    await this.redis.del(REFRESH_PREFIX + userId);
    return { success: true };
  }

  async deleteAccount(userId: string) {
    await this.ensureAuthIdentityTable();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new UnauthorizedException('User not found');

    await this.prisma.$transaction(async (tx) => {
      // V3 一期：显式清理用户写入但无 onDelete=Cascade 兜底的表
      // (Cascade 的 family_members / user_activities / intel_deliveries / deepfake_checks /
      //  breach_targets / breach_alerts / auth_identities / user_devices 会自动随 user 删除)
      await tx.query.deleteMany({ where: { userId } });
      await tx.report.deleteMany({ where: { userId } });
      await tx.subscription.deleteMany({ where: { userId } });
      await tx.userMessageRead.deleteMany({ where: { userId } });
      await tx.userFeedback.deleteMany({ where: { userId } });
      // S3-5：family_broadcasts.triggered_by_user_id 已 SET NULL（schema），无需显式清理
      //       family_groups.owner_user_id Cascade 会自动解散 owner=self 的家庭组
      // 最后 delete user，触发剩余 Cascade
      await tx.user.delete({ where: { id: userId } });
    });

    await this.redis.del(REFRESH_PREFIX + userId);
    return { success: true };
  }

  /**
   * S3-5 用户数据导出（GDPR / 个保法 right of access）
   *
   * 返回一份 JSON，含用户主表 + V3 所有衍生数据。二进制（音频/图片）以 URL 形式返回，
   * 不内嵌避免 payload 过大。
   * 调用方：iOS 设置页"导出我的数据"按钮 → 客户端直接保存为 .json
   */
  async exportUserData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        email: true,
        nickname: true,
        gender: true,
        birthday: true,
        country: true,
        regionCode: true,
        language: true,
        isMinor: true,
        parentConsentAt: true,
        subscriptionStatus: true,
        subscriptionExpire: true,
        familyGroupId: true,
        userLevel: true,
        elderModeEnabled: true,
        lastActiveAt: true,
        createdAt: true,
      },
    });
    if (!user) throw new UnauthorizedException('User not found');

    const [
      queries,
      reports,
      subscriptions,
      familyMember,
      userActivities,
      intelSubmissions,
      intelDeliveries,
      intelPreferences,
      deepfakeChecks,
      breachTargets,
      breachAlerts,
      authIdentities,
      devices,
      messageReads,
    ] = await Promise.all([
      this.prisma.query.findMany({ where: { userId } }),
      this.prisma.report.findMany({ where: { userId } }),
      this.prisma.subscription.findMany({ where: { userId } }),
      this.prisma.familyMember.findFirst({ where: { userId } }),
      this.prisma.userActivity.findMany({ where: { userId } }),
      this.prisma.intelSubmission.findMany({ where: { userId } }),
      this.prisma.intelDelivery.findMany({ where: { userId } }),
      this.prisma.userIntelPreferences.findFirst({ where: { userId } }),
      this.prisma.deepfakeCheck.findMany({ where: { userId } }),
      this.prisma.breachTarget.findMany({ where: { userId } }),
      this.prisma.breachAlert.findMany({ where: { userId } }),
      this.prisma.authIdentity.findMany({ where: { userId } }),
      this.prisma.userDevice.findMany({ where: { userId } }),
      this.prisma.userMessageRead.findMany({ where: { userId } }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      schemaVersion: 'v3.1',
      user,
      queries,
      reports,
      subscriptions,
      family: { membership: familyMember, activities: userActivities },
      intel: {
        submissions: intelSubmissions,
        deliveries: intelDeliveries,
        preferences: intelPreferences,
      },
      deepfakeChecks,
      breach: { targets: breachTargets, alerts: breachAlerts },
      authIdentities,
      devices,
      messageReads,
    };
  }

  /** 供管理后台等使用：根据已有用户签发 token（会更新 lastLogin） */
  async issueTokensForUser(user: { id: string; role: UserRole }) {
    await this.recordLogin(user.id);
    return this.issueTokens(user);
  }

  async getUserInfo(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        email: true,
        country: true,
        avatar: true,
        nickname: true,
        wechatNickname: true,
        gender: true,
        birthday: true,
        role: true,
        lastLogin: true,
        subscriptionStatus: true,
        subscriptionExpire: true,
        createdAt: true,
        // V3 新增字段
        elderModeEnabled: true,
        language: true,
        regionCode: true,
      },
    });
    if (!user) throw new UnauthorizedException('User not found');
    const u = user as any;
    return {
      ...u,
      birthday: u.birthday ? (u.birthday as Date).toISOString().slice(0, 10) : null,
      subscriptionExpire: u.subscriptionExpire ? (u.subscriptionExpire as Date).toISOString().slice(0, 10) : null,
      // V3 snake_case 别名（iOS Codable 期望 elder_mode_enabled / region_code）
      elder_mode_enabled: u.elderModeEnabled ?? false,
      region_code: u.regionCode ?? null,
    };
  }

  private async ensureAuthIdentityTable() {
    if (this.ensuredIdentityTable) return;
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS auth_identities (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider VARCHAR(20) NOT NULL,
        provider_sub VARCHAR(191) NOT NULL,
        provider_email VARCHAR(191),
        provider_phone VARCHAR(32),
        is_verified BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(provider, provider_sub)
      );
    `);
    await this.prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS idx_auth_identities_user_id ON auth_identities(user_id);`,
    );
    await this.prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS idx_auth_identities_provider_email ON auth_identities(provider_email);`,
    );
    this.ensuredIdentityTable = true;
  }

  private async getAppleJwks(): Promise<AppleJwk[]> {
    const now = Date.now();
    if (this.appleKeysCache && now - this.appleKeysCache.at < 6 * 60 * 60 * 1000) {
      return this.appleKeysCache.keys;
    }
    let resp: Awaited<ReturnType<typeof axios.get<{ keys: AppleJwk[] }>>>;
    try {
      resp = await axios.get<{ keys: AppleJwk[] }>(
        'https://appleid.apple.com/auth/keys',
        { timeout: 5000 },
      );
    } catch (e) {
      throw new UnauthorizedException('Failed to fetch Apple public keys');
    }
    const keys = Array.isArray(resp.data?.keys) ? resp.data.keys : [];
    if (!keys.length) throw new UnauthorizedException('Apple keys unavailable');
    this.appleKeysCache = { at: now, keys };
    return keys;
  }

  private async verifyAppleIdentityToken(
    identityToken: string,
    nonce?: string,
  ): Promise<AppleIdTokenPayload> {
    const token = (identityToken || '').trim();
    if (!token) throw new UnauthorizedException('identityToken is required');
    const audience = this.appleAudience;
    if (!audience) {
      throw new UnauthorizedException('APPLE_BUNDLE_ID is not configured');
    }

    const decoded = nodeJwt.decode(token, { complete: true }) as
      | { header?: { kid?: string; alg?: string } }
      | null;
    const kid = decoded?.header?.kid;
    const alg = decoded?.header?.alg;
    if (!kid || alg !== 'RS256') {
      throw new UnauthorizedException('Invalid Apple token header');
    }

    const jwks = await this.getAppleJwks();
    const jwk = jwks.find((k) => k.kid === kid && k.alg === 'RS256');
    if (!jwk) throw new UnauthorizedException('Apple key not found');

    const publicKey = createPublicKey({ key: jwk as any, format: 'jwk' });
    let payload: AppleIdTokenPayload;
    try {
      payload = nodeJwt.verify(token, publicKey, {
        algorithms: ['RS256'],
        issuer: 'https://appleid.apple.com',
        audience,
      }) as AppleIdTokenPayload;
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      // 常见原因：APPLE_BUNDLE_ID 与 token 的 aud 不匹配，或 token 已过期
      throw new UnauthorizedException(`Apple token verification failed: ${detail}`);
    }

    if (nonce && payload.nonce && payload.nonce !== nonce) {
      throw new UnauthorizedException('Invalid nonce');
    }
    return payload;
  }
}
