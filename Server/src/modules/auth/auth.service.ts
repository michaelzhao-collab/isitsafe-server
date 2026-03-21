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
import { UserRole } from '@prisma/client';
import { LoginPhoneDto, LoginEmailDto } from './dto/login.dto';

const LOCK_KEY = 'auth:lock:';
const ATTEMPTS_KEY = 'auth:attempts:';
const REFRESH_PREFIX = 'refresh:';
const SMS_SEND_PREFIX = 'sms:send:';
const E164_RE = /^\+[1-9]\d{6,14}$/;

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

  /** MVP：验证码固定为 123456（不发真实短信） */
  private readonly MOCK_CODE = '123456';

  private readonly smsMessage =
    '[StarLensAI] Your verification code is: 123456. It will expire in 5 minutes.';

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
}
