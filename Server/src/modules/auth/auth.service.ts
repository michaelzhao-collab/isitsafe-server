import { Injectable, UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { UserRole } from '@prisma/client';
import { LoginPhoneDto, LoginEmailDto, LoginSmsDto } from './dto/login.dto';

const LOCK_KEY = 'auth:lock:';
const ATTEMPTS_KEY = 'auth:attempts:';
const REFRESH_PREFIX = 'refresh:';

@Injectable()
export class AuthService {
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

  /** MVP 验证码写死为 123456，未传 code 时不校验（兼容旧端） */
  private readonly MOCK_CODE = '123456';

  /**
   * 统一登录入口：body 含 phone 则按手机登录，含 email 则按邮箱登录；传了 code 时仅接受 123456
   */
  async login(
    body: { phone?: string; email?: string; code?: string; smsCode?: string },
    ip?: string,
  ) {
    if (body.phone) {
      if (body.code != null && body.code !== this.MOCK_CODE) {
        throw new UnauthorizedException('验证码错误');
      }
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
    return this.login({ phone: dto.phone, code: dto.code }, ip);
  }

  async loginEmail(dto: LoginEmailDto, ip?: string) {
    return this.login({ email: dto.email, code: dto.code }, ip);
  }

  async loginSms(dto: LoginSmsDto, ip?: string) {
    return this.login({ phone: dto.phone, smsCode: dto.smsCode }, ip);
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
}
