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
import axios from 'axios';
import { UserRole } from '@prisma/client';
import {
  LoginPhoneDto,
  LoginEmailDto,
  AppleLoginDto,
  SocialLoginDto,
} from './dto/login.dto';

const LOCK_KEY = 'auth:lock:';
const ATTEMPTS_KEY = 'auth:attempts:';
const REFRESH_PREFIX = 'refresh:';
const SMS_SEND_PREFIX = 'sms:send:';
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
  ) {}

  private get maxAttempts() {
    return parseInt(this.config.get('LOGIN_MAX_ATTEMPTS', '5'), 10);
  }

  private get lockMinutes() {
    return parseInt(this.config.get('LOGIN_LOCK_MINUTES', '15'), 10);
  }

  /** MVP：验证码固定为 123456（不发真实短信） */
  private readonly MOCK_CODE = '123456';

  private readonly smsMessage =
    '[StarLensAI] Your verification code is: 123456. It will expire in 5 minutes.';

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
   * 统一登录入口：手机登录需 smsCode 或 code 为 123456；邮箱登录传 code 时仅接受 123456
   */
  async login(
    body: { phone?: string; email?: string; code?: string; smsCode?: string },
    ip?: string,
  ) {
    if (body.phone) {
      if (!E164_RE.test(body.phone)) {
        throw new BadRequestException('Invalid phone number');
      }
      const otp = body.smsCode ?? body.code;
      if (otp == null || String(otp).trim() === '') {
        throw new UnauthorizedException('请输入验证码');
      }
      if (String(otp) !== this.MOCK_CODE) {
        throw new UnauthorizedException('验证码错误');
      }
      await this.checkLock(body.phone);
      const user = await this.prisma.user.upsert({
        where: { phone: body.phone },
        create: {
          phone: body.phone,
          country: this.countryHintFromE164(body.phone),
        },
        update: {},
      });
      await this.recordLogin(user.id);
      await this.clearAttempts(body.phone);
      return this.issueTokens(user);
    }
    if (body.email) {
      if (body.code != null && body.code !== this.MOCK_CODE) {
        throw new UnauthorizedException('验证码错误');
      }
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

  async loginPhone(dto: LoginPhoneDto, ip?: string) {
    return this.login(
      { phone: dto.phone, code: dto.code, smsCode: dto.smsCode },
      ip,
    );
  }

  async loginEmail(dto: LoginEmailDto, ip?: string) {
    return this.login({ email: dto.email, code: dto.code }, ip);
  }

  async loginSocial(dto: SocialLoginDto) {
    if (dto.provider === 'apple') {
      return this.loginApple(dto);
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

  async loginApple(dto: AppleLoginDto) {
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
    return this.issueTokens(user);
  }

  /** 同一号码 5 分钟内仅允许请求一次「验证码」；当前固定返回 123456 */
  async sendSmsCode(phone: string) {
    if (!E164_RE.test(phone)) {
      throw new BadRequestException('Invalid phone number');
    }
    const key = SMS_SEND_PREFIX + phone;
    try {
      const existed = await this.redis.get(key);
      if (existed) {
        throw new HttpException(
          'Too many requests. Please try again in 5 minutes.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      await this.redis.set(key, '1', 300);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      // Redis 不可用时跳过频控
    }
    return { message: this.smsMessage, code: this.MOCK_CODE };
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
      },
    });
    if (!user) throw new UnauthorizedException('User not found');
    const u = user as any;
    return {
      ...u,
      birthday: u.birthday ? (u.birthday as Date).toISOString().slice(0, 10) : null,
      subscriptionExpire: u.subscriptionExpire ? (u.subscriptionExpire as Date).toISOString().slice(0, 10) : null,
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
    const resp = await axios.get<{ keys: AppleJwk[] }>(
      'https://appleid.apple.com/auth/keys',
      { timeout: 5000 },
    );
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
    const payload = nodeJwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      issuer: 'https://appleid.apple.com',
      audience,
    }) as AppleIdTokenPayload;

    if (nonce && payload.nonce && payload.nonce !== nonce) {
      throw new UnauthorizedException('Invalid nonce');
    }
    return payload;
  }
}
