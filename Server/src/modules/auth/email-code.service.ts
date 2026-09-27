import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { createHash, randomInt, timingSafeEqual } from 'crypto';
import { RedisService } from '../../redis/redis.service';
import { MailService } from '../mail/mail.service';

/** 验证码有效期 */
const CODE_TTL_SEC = 600; // 10 分钟
/** 同一邮箱两次发送之间的最短间隔 */
const RESEND_COOLDOWN_SEC = 60;
/** 同一邮箱每小时最多发几次 */
const MAX_SENDS_PER_EMAIL_HOUR = 5;
/** 同一 IP 每小时最多发几次（防止拿别人邮箱当轰炸目标） */
const MAX_SENDS_PER_IP_HOUR = 20;
/** 同一个验证码最多验几次，超过即作废（防爆破：6 位 = 100 万种，5 次几乎不可能撞中） */
const MAX_VERIFY_ATTEMPTS = 5;

const CODE_KEY = 'email_login_code:';
const COOLDOWN_KEY = 'email_login_cooldown:';
const EMAIL_QUOTA_KEY = 'email_login_quota:';
const IP_QUOTA_KEY = 'email_login_ip_quota:';

/** Apple「隐藏邮箱」转发域，往这里发信要求发信域名在苹果开发者后台注册过，否则退信 */
const APPLE_RELAY_SUFFIX = '@privaterelay.appleid.com';

/**
 * 邮箱验证码登录（2026-09-08 新增）。
 *
 * 安全取舍：
 * - Redis 里只存验证码的 SHA-256，不存明文；比对用 timingSafeEqual。
 * - **Redis 不可用时一律拒绝**（fail closed）。项目里别处为了可用性对 Redis 故障降级放行，
 *   但验证码是身份凭证，放行等于任何人凭邮箱直接登录 —— 正是 2026-09-07 复核修掉的那个洞。
 * - 验证码一次性：验证成功立即删除，失败累计 5 次即作废。
 * - 发送侧三重限流：邮箱冷却 60s、邮箱每小时 5 次、IP 每小时 20 次。
 */
@Injectable()
export class EmailCodeService {
  private readonly logger = new Logger(EmailCodeService.name);

  constructor(
    private redis: RedisService,
    private mail: MailService,
  ) {}

  /** 统一小写去空格，避免 A@b.com 与 a@b.com 被当成两个账号 */
  normalizeEmail(email: string): string {
    return (email || '').trim().toLowerCase();
  }

  /**
   * 生成并发送登录验证码。
   * 返回给客户端的信息里不包含"该邮箱是否已注册"，避免被拿来枚举用户。
   */
  async sendLoginCode(
    rawEmail: string,
    opts: { ip?: string; language?: string } = {},
  ): Promise<{ cooldownSeconds: number; expiresInSeconds: number }> {
    try {
      return await this.sendLoginCodeInner(rawEmail, opts);
    } catch (err) {
      // 限流/参数类错误原样抛给客户端；Redis 或其他基础设施异常一律 503（fail closed）
      if (err instanceof HttpException) throw err;
      this.logger.error(`[EmailCode] 发送流程异常：${(err as any)?.message ?? err}`);
      throw new HttpException('服务暂时不可用，请稍后重试', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  private async sendLoginCodeInner(
    rawEmail: string,
    opts: { ip?: string; language?: string },
  ): Promise<{ cooldownSeconds: number; expiresInSeconds: number }> {
    const email = this.normalizeEmail(rawEmail);

    if (email.endsWith(APPLE_RELAY_SUFFIX) && !this.allowAppleRelay) {
      // 往 Apple 私密转发地址发信，需要发信域名先在苹果开发者后台登记，否则必退信。
      // 与其发出去石沉大海，不如直接告诉用户改用「通过 Apple 登录」。
      throw new BadRequestException('该邮箱是 Apple 隐藏邮箱，请改用「通过 Apple 登录」');
    }

    const client = this.getClientOrThrow();

    // 1) 冷却：同一邮箱 60s 内只能发一次
    const cooldownKey = COOLDOWN_KEY + email;
    const ttl = await client.ttl(cooldownKey);
    if (ttl > 0) {
      throw new HttpException(
        { message: `发送太频繁，请 ${ttl} 秒后再试`, retryAfterSeconds: ttl },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 2) 小时配额：邮箱维度 + IP 维度
    await this.consumeQuota(EMAIL_QUOTA_KEY + email, MAX_SENDS_PER_EMAIL_HOUR, '该邮箱今日请求过多，请稍后再试');
    if (opts.ip) {
      await this.consumeQuota(IP_QUOTA_KEY + opts.ip, MAX_SENDS_PER_IP_HOUR, '请求过于频繁，请稍后再试');
    }

    // 3) 生成验证码并落 Redis（存哈希）
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await client.set(
      CODE_KEY + email,
      JSON.stringify({ hash: this.hash(code), attempts: 0 }),
      'EX',
      CODE_TTL_SEC,
    );
    await client.set(cooldownKey, '1', 'EX', RESEND_COOLDOWN_SEC);

    // 4) 发信。发送失败要把验证码作废，否则用户收不到却占着一个有效码
    // 2026-09-27 产品要求：默认英文。客户端会按 App 内语言显式传 zh/en；
    // 未传（第三方调用 / 脚本）时用英文，只有明确 zh 才发中文。
    const isEn = !(opts.language || '').toLowerCase().startsWith('zh');
    const sent = await this.mail.send({
      to: email,
      subject: isEn ? `${code} is your StarLens AI sign-in code` : `${code} 是你的星识安全助手登录验证码`,
      text: this.renderText(code, isEn),
      html: this.renderHtml(code, isEn),
      tag: 'login-code',
    });
    if (!sent.delivered && this.mail.isConfigured) {
      await client.del(CODE_KEY + email);
      await client.del(cooldownKey);
      throw new HttpException('验证码发送失败，请稍后重试', HttpStatus.SERVICE_UNAVAILABLE);
    }

    return { cooldownSeconds: RESEND_COOLDOWN_SEC, expiresInSeconds: CODE_TTL_SEC };
  }

  /**
   * 校验验证码。成功即删除（一次性）。
   * 任何异常路径都返回 false，由调用方统一抛"验证码错误或已过期"，不区分原因。
   */
  async verifyLoginCode(rawEmail: string, code: string): Promise<boolean> {
    try {
      return await this.verifyLoginCodeInner(rawEmail, code);
    } catch (err) {
      // Redis 挂了不能放行：验证码是身份凭证，放行等于凭邮箱直接登录
      this.logger.error(`[EmailCode] 校验流程异常，按失败处理：${(err as any)?.message ?? err}`);
      return false;
    }
  }

  private async verifyLoginCodeInner(rawEmail: string, code: string): Promise<boolean> {
    const email = this.normalizeEmail(rawEmail);
    if (!/^\d{6}$/.test(code ?? '')) return false;

    const client = this.getClientOrThrow();
    const key = CODE_KEY + email;
    const raw = await client.get(key);
    if (!raw) return false;

    let record: { hash: string; attempts: number };
    try {
      record = JSON.parse(raw);
    } catch {
      await client.del(key);
      return false;
    }

    if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
      await client.del(key);
      return false;
    }

    if (!this.constantTimeEqual(this.hash(code), record.hash)) {
      // 失败计数写回，保留原 TTL
      const ttl = await client.ttl(key);
      record.attempts += 1;
      if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
        await client.del(key);
      } else {
        await client.set(key, JSON.stringify(record), 'EX', ttl > 0 ? ttl : CODE_TTL_SEC);
      }
      return false;
    }

    await client.del(key);
    return true;
  }

  private get allowAppleRelay(): boolean {
    // 发信域名在苹果开发者后台完成登记后，把这个开关打开即可放行
    return process.env.ALLOW_APPLE_RELAY_EMAIL === 'true';
  }

  private getClientOrThrow() {
    try {
      const client = this.redis.getClient();
      if (!client) throw new Error('redis client is null');
      return client;
    } catch (err: any) {
      this.logger.error(`[EmailCode] Redis 不可用，拒绝邮箱验证码流程：${err?.message ?? err}`);
      throw new HttpException('服务暂时不可用，请稍后重试', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  /** 小时滑窗配额：首次写入时设 1 小时过期 */
  private async consumeQuota(key: string, limit: number, message: string): Promise<void> {
    const client = this.getClientOrThrow();
    const used = await client.incr(key);
    if (used === 1) await client.expire(key, 3600);
    if (used > limit) {
      const ttl = await client.ttl(key);
      throw new HttpException(
        { message, retryAfterSeconds: ttl > 0 ? ttl : 3600 },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private hash(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  private constantTimeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }

  private renderText(code: string, isEn: boolean): string {
    return isEn
      ? `Your StarLens AI sign-in code is ${code}.\n\nIt expires in 10 minutes and can be used once.\nIf you did not request this, you can ignore this email.`
      : `你的星识安全助手登录验证码是 ${code}。\n\n验证码 10 分钟内有效，只能使用一次。\n如果这不是你本人的操作，忽略这封邮件即可。`;
  }

  private renderHtml(code: string, isEn: boolean): string {
    const title = isEn ? 'Sign-in code' : '登录验证码';
    const hint = isEn
      ? 'It expires in 10 minutes and can be used once. If you did not request this, you can ignore this email.'
      : '验证码 10 分钟内有效，只能使用一次。如果这不是你本人的操作，忽略这封邮件即可。';
    const brand = isEn ? 'StarLens AI' : '星识安全助手';
    return `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'PingFang SC','Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:14px;padding:32px 28px;">
    <div style="font-size:15px;color:#6b7280;margin-bottom:6px;">${brand}</div>
    <div style="font-size:20px;font-weight:600;color:#111827;margin-bottom:20px;">${title}</div>
    <div style="font-size:34px;font-weight:700;letter-spacing:8px;color:#2563eb;padding:16px 0;">${code}</div>
    <div style="font-size:13px;color:#6b7280;line-height:1.7;margin-top:16px;">${hint}</div>
  </div>
</body></html>`;
  }
}
