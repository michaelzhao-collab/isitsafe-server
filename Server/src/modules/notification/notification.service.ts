import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

/**
 * 通知抽象层（V3-E 关怀机制 / V3-B 情报推送依赖）
 *
 * 实现策略：
 *  - 全部通过 HTTP API 调用（不引入 SDK 依赖，避免 package-lock 大改）
 *  - 密钥通过环境变量配置；未配置时 fallback 到 console.log
 *  - 调用方接口稳定，provider 切换不影响业务侧
 *
 * 支持 provider：
 *  - APNs：HTTP/2 + JWT ES256（一期 stub；二期上 @parse/node-apn 或自实现）
 *  - 阿里云短信：HTTP API 签名复杂，需要 SDK；一期 stub
 *  - Twilio：Basic Auth + HTTP POST（一期可直接接入）
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  // ====================================================================
  // Push（一期 stub，二期接 @parse/node-apn）
  // ====================================================================
  async sendPush(params: {
    userId: string;
    title: string;
    body: string;
    category?: string;
    customData?: Record<string, unknown>;
    deviceToken?: string; // 二期：从 user_devices 表查
  }): Promise<{ delivered: boolean; messageId?: string; reason?: string }> {
    const apnsConfigured = !!(
      process.env.APNS_TEAM_ID &&
      process.env.APNS_KEY_ID &&
      process.env.APNS_AUTH_KEY &&
      process.env.APNS_BUNDLE_ID
    );
    if (!apnsConfigured || !params.deviceToken) {
      this.logger.log(
        `[Push:stub] user=${params.userId} title="${params.title}" body="${params.body}" cat=${params.category ?? 'default'} reason=${!apnsConfigured ? 'apns_not_configured' : 'no_device_token'}`,
      );
      // ⚠️ 重要：stub 不能返 delivered:true，否则上层（如 family_care_notices）会写"已送达"误导审计
      return {
        delivered: false,
        reason: !apnsConfigured ? 'apns_not_configured' : 'no_device_token',
      };
    }

    // 真实 APNs 实现需要 HTTP/2 + JWT 签名。Node.js 内建 http2 + jsonwebtoken 可实现。
    // 这里返回 stub，待二期完整实现（带连接池 + 失败重试 + token 失效清理）。
    this.logger.warn('[Push] APNs configured but production path not yet implemented');
    return { delivered: false, reason: 'apns_impl_pending' };
  }

  async sendPushBatch(items: Array<{
    userId: string;
    title: string;
    body: string;
    category?: string;
    customData?: Record<string, unknown>;
    deviceToken?: string;
  }>): Promise<{ delivered: number; failed: number }> {
    // 并发发送，避免百人家庭组串行卡几十秒
    const results = await Promise.allSettled(items.map((item) => this.sendPush(item)));
    let delivered = 0;
    let failed = 0;
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.delivered) delivered++;
      else failed++;
    }
    return { delivered, failed };
  }

  // ====================================================================
  // SMS：region 路由 → CN 阿里云 / INTL Twilio
  // ====================================================================
  async sendSms(params: {
    userId: string;
    phone: string;
    template: 'family_care_inactive';
    variables: Record<string, string>;
    region: 'CN' | 'INTL';
  }): Promise<{ delivered: boolean; messageId?: string; cost?: number; provider?: string }> {
    if (params.region === 'CN') {
      return this.sendSmsAliyun(params);
    }
    return this.sendSmsTwilio(params);
  }

  private async sendSmsAliyun(params: {
    userId: string;
    phone: string;
    template: 'family_care_inactive';
    variables: Record<string, string>;
  }): Promise<{ delivered: boolean; messageId?: string; cost?: number; provider?: string }> {
    const configured = !!(
      process.env.ALIYUN_SMS_ACCESS_KEY_ID &&
      process.env.ALIYUN_SMS_ACCESS_KEY_SECRET &&
      process.env.ALIYUN_SMS_SIGN_NAME &&
      process.env.ALIYUN_SMS_TEMPLATE_CODE_FAMILY_CARE
    );
    if (!configured) {
      this.logger.log(
        `[SMS:CN-stub] user=${params.userId} phone=${this.maskPhone(params.phone)} vars=${JSON.stringify(params.variables)}`,
      );
      return { delivered: false, provider: 'stub' };
    }
    // 阿里云 SMS HTTP API 签名复杂（POP-API v3），生产建议使用 SDK @alicloud/dysmsapi20170525
    // 此处留接口示意；TODO 二期接 SDK
    this.logger.warn('[SMS:CN] Aliyun configured but production signing path needs SDK; using stub');
    return { delivered: false, provider: 'aliyun' };
  }

  private async sendSmsTwilio(params: {
    userId: string;
    phone: string;
    template: 'family_care_inactive';
    variables: Record<string, string>;
  }): Promise<{ delivered: boolean; messageId?: string; cost?: number; provider?: string }> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;
    if (!accountSid || !authToken || !from) {
      this.logger.log(
        `[SMS:INTL-stub] user=${params.userId} phone=${this.maskPhone(params.phone)} vars=${JSON.stringify(params.variables)}`,
      );
      return { delivered: false, provider: 'stub' };
    }

    const body = this.renderTemplate(params.template, params.variables, 'INTL');
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      const form = new URLSearchParams();
      form.append('To', params.phone);
      form.append('From', from);
      form.append('Body', body);

      const resp = await axios.post(url, form, {
        auth: { username: accountSid, password: authToken },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000,
      });
      const sid = resp.data?.sid;
      return { delivered: true, messageId: sid, provider: 'twilio' };
    } catch (err: any) {
      this.logger.error(`[SMS:Twilio] failed: ${err?.response?.data?.message ?? err?.message}`);
      return { delivered: false, provider: 'twilio' };
    }
  }

  private renderTemplate(template: string, vars: Record<string, string>, region: 'CN' | 'INTL'): string {
    // 一期固定模板
    if (template === 'family_care_inactive') {
      if (region === 'CN') {
        return `【StarLens】您的家人 ${vars.inactiveName} 已连续 ${vars.days} 天未打开 App，请联系确认安全。`;
      }
      return `[StarLens] Your family member ${vars.inactiveName} hasn't opened the app for ${vars.days} days. Please check on them.`;
    }
    return JSON.stringify(vars);
  }

  private maskPhone(phone: string): string {
    if (phone.length < 7) return '***';
    return phone.slice(0, 3) + '****' + phone.slice(-4);
  }
}
