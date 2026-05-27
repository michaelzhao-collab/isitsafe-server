import { Injectable, Logger } from '@nestjs/common';

/**
 * 通知抽象层（V3-E 关怀机制依赖）
 *
 * 一期：仅 console.log 占位，便于早期联调
 * 二期：接入真实 APNs / 阿里云短信 / Twilio（按 user.regionCode 路由）
 *
 * 公开 send* 系列方法保持稳定；底层 provider 切换不影响调用方。
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  /**
   * APNs push（一期 stub）
   */
  async sendPush(params: {
    userId: string;
    title: string;
    body: string;
    category?: string;
    customData?: Record<string, unknown>;
  }): Promise<{ delivered: boolean; messageId?: string }> {
    this.logger.log(
      `[Push] user=${params.userId} title=${params.title} cat=${params.category ?? 'default'}`,
    );
    // TODO: 接入真实 APNs（参考 node-apn 或 apple-push-server）
    return { delivered: true, messageId: `mock_push_${Date.now()}` };
  }

  /**
   * 短信（一期 stub）
   * 国内：路由阿里云短信；海外：路由 Twilio
   */
  async sendSms(params: {
    userId: string;
    phone: string;
    template: 'family_care_inactive';
    variables: Record<string, string>;
    region: 'CN' | 'INTL';
  }): Promise<{ delivered: boolean; messageId?: string; cost?: number }> {
    this.logger.log(
      `[SMS][${params.region}] user=${params.userId} phone=${this.maskPhone(params.phone)} template=${params.template} vars=${JSON.stringify(params.variables)}`,
    );
    // TODO 接入真实 provider：
    //   if (region === 'CN') return aliyunSms.send(...)
    //   else                  return twilio.send(...)
    return { delivered: true, messageId: `mock_sms_${Date.now()}`, cost: 0.045 };
  }

  /**
   * 批量 push（一期 stub）
   */
  async sendPushBatch(items: Array<{
    userId: string;
    title: string;
    body: string;
    category?: string;
    customData?: Record<string, unknown>;
  }>): Promise<{ delivered: number; failed: number }> {
    let delivered = 0;
    let failed = 0;
    for (const item of items) {
      const r = await this.sendPush(item);
      if (r.delivered) delivered++;
      else failed++;
    }
    return { delivered, failed };
  }

  private maskPhone(phone: string): string {
    if (phone.length < 7) return '***';
    return phone.slice(0, 3) + '****' + phone.slice(-4);
  }
}
