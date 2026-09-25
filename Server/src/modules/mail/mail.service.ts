import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * 事务邮件发送（Brevo）。
 *
 * 2026-09-08：项目此前没有任何邮件通道（阿里云短信是 stub，邮件为零），
 * 邮箱验证码登录需要它。选型由产品拍板：Brevo，发信域名用 App 自有域名。
 *
 * 接口：POST https://api.brevo.com/v3/smtp/email，鉴权走 `api-key` 请求头。
 * 已实测：无 key → 401 {"code":"unauthorized","message":"authentication not found in headers"}；
 *        key 无效 → 401 {"code":"unauthorized","message":"Key not found"}。
 *
 * 未配置 BREVO_API_KEY 时不报错，返回 delivered=false 并把内容打到日志，
 * 让本地开发/联调不依赖真实邮件通道（生产必须配置，见 isConfigured）。
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly endpoint = 'https://api.brevo.com/v3/smtp/email';
  private readonly timeoutMs = 10_000;

  constructor(private config: ConfigService) {}

  get isConfigured(): boolean {
    return !!this.config.get<string>('BREVO_API_KEY');
  }

  private get sender(): { email: string; name: string } {
    return {
      email: this.config.get<string>('MAIL_FROM_EMAIL', 'no-reply@starlensai.com'),
      name: this.config.get<string>('MAIL_FROM_NAME', 'StarLens AI'),
    };
  }

  /**
   * 发送一封事务邮件。
   * 返回 delivered 表示"服务商已接收"，不代表已投递到收件箱。
   */
  async send(params: {
    to: string;
    subject: string;
    html: string;
    text: string;
    /** 便于在 Brevo 后台按类型筛选 */
    tag?: string;
  }): Promise<{ delivered: boolean; messageId?: string; error?: string }> {
    const apiKey = this.config.get<string>('BREVO_API_KEY');
    if (!apiKey) {
      // 开发兜底：不静默丢弃，把正文打出来，本地就能拿到验证码继续联调
      this.logger.warn(
        `[Mail] BREVO_API_KEY 未配置，邮件未发送。to=${params.to} subject=${params.subject}\n${params.text}`,
      );
      return { delivered: false, error: 'not_configured' };
    }

    const replyTo = this.config.get<string>('MAIL_REPLY_TO');
    const body: Record<string, unknown> = {
      sender: this.sender,
      to: [{ email: params.to }],
      subject: params.subject,
      htmlContent: params.html,
      textContent: params.text,
    };
    if (replyTo) body.replyTo = { email: replyTo };
    if (params.tag) body.tags = [params.tag];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const raw = await res.text();
      if (!res.ok) {
        // 不要把 apiKey 或完整正文写进日志
        this.logger.error(
          `[Mail] Brevo 发送失败 status=${res.status} to=${this.maskEmail(params.to)} body=${raw.slice(0, 200)}`,
        );
        return { delivered: false, error: `brevo_${res.status}` };
      }
      let messageId: string | undefined;
      try {
        messageId = JSON.parse(raw)?.messageId;
      } catch {
        // 忽略解析失败，只影响日志
      }
      this.logger.log(`[Mail] 已提交 to=${this.maskEmail(params.to)} messageId=${messageId ?? '-'}`);
      return { delivered: true, messageId };
    } catch (err: any) {
      const reason = err?.name === 'AbortError' ? 'timeout' : (err?.message ?? 'unknown');
      this.logger.error(`[Mail] Brevo 请求异常 to=${this.maskEmail(params.to)} reason=${reason}`);
      return { delivered: false, error: reason };
    } finally {
      clearTimeout(timer);
    }
  }

  /** 日志里不写完整邮箱 */
  private maskEmail(email: string): string {
    const [name, domain] = email.split('@');
    if (!domain) return '***';
    const head = name.slice(0, 2);
    return `${head}${'*'.repeat(Math.max(1, name.length - 2))}@${domain}`;
  }
}
