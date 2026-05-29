import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import axios from 'axios';
import * as http2 from 'http2';
import { createSign, createPrivateKey } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * 通知抽象层（V3-E 关怀机制 / V3-B 情报推送依赖）
 *
 * S1-5 改造：
 *  - APNs 由 stub 替换为 HTTP/2 + ES256 JWT 真实实现（零新增依赖，Node 内建即可）
 *  - sendPush 不再要求 caller 传 deviceToken，按 userId 自动从 user_devices 表 lookup
 *  - 短信仍是 Twilio HTTP（CN 阿里云待 S3 加 SDK）
 *
 * APNs 实现要点：
 *  - JWT 用 ES256（P-256 ECDSA）签名，dsaEncoding=ieee-p1363 直接得到 64 字节 JOSE 签名
 *  - JWT 50 分钟 rotate 一次（Apple 60 分钟后拒）；用 cached jwt
 *  - 复用一条 HTTP/2 连接给 prod 和一条给 sandbox；GOAWAY/close 时下次自动重连
 *  - 失败 → user_devices.failure_count += 1；410 Unregistered 直接清理
 *
 * 配置（缺一返 stub log）：
 *  APNS_TEAM_ID            Apple Developer Team ID (10 chars)
 *  APNS_KEY_ID             APNs Auth Key ID (10 chars)
 *  APNS_AUTH_KEY           .p8 PEM 内容（含 BEGIN/END 行与换行）
 *  APNS_BUNDLE_ID          App Bundle ID, e.g. com.starlens.IsItSafe
 *  APNS_ENV                'production' | 'sandbox'，默认 production
 */
@Injectable()
export class NotificationService implements OnModuleDestroy {
  private readonly logger = new Logger(NotificationService.name);

  /// JWT 缓存：50 分钟（Apple 60 分钟硬上限）
  private jwtCache: { token: string; expiresAt: number } | null = null;
  /// 同时维护 prod 和 sandbox 两条连接，按需懒加载
  private clients: Map<'production' | 'sandbox', http2.ClientHttp2Session> = new Map();

  constructor(private prisma: PrismaService) {}

  // ====================================================================
  // Push（S1-5 真实实现）
  // ====================================================================

  /**
   * 给单个 userId 发送 push。
   *
   * 行为：
   *  - 未配置 APNS 全部环境变量 → log stub，返 delivered=false, reason='apns_not_configured'
   *  - 配置完整但 user 无登记 device → 返 delivered=false, reason='no_device'
   *  - 多设备：并发推所有，全部失败才视为整体失败；任一成功即 delivered=true
   */
  async sendPush(params: {
    userId: string;
    title: string;
    body: string;
    category?: string;
    customData?: Record<string, unknown>;
    /** 可选：caller 直接给 token，跳过 DB 查找 */
    deviceToken?: string;
  }): Promise<{ delivered: boolean; messageId?: string; reason?: string }> {
    const apnsConfigured = this.isApnsConfigured();
    if (!apnsConfigured) {
      this.logger.log(
        `[Push:stub] user=${params.userId} title="${params.title}" body="${params.body}" cat=${params.category ?? 'default'} reason=apns_not_configured`,
      );
      return { delivered: false, reason: 'apns_not_configured' };
    }

    // 候选 device 列表
    let devices: { id: string; deviceToken: string; environment: string }[];
    if (params.deviceToken) {
      devices = [{ id: 'inline', deviceToken: params.deviceToken, environment: process.env.APNS_ENV || 'production' }];
    } else {
      devices = await this.prisma.userDevice.findMany({
        where: { userId: params.userId, platform: 'ios', failureCount: { lt: 5 } },
        select: { id: true, deviceToken: true, environment: true },
      });
    }
    if (devices.length === 0) {
      this.logger.log(`[Push] user=${params.userId} no_device`);
      return { delivered: false, reason: 'no_device' };
    }

    const payload = this.buildApsPayload(params);
    const results = await Promise.all(
      devices.map((d) =>
        this.deliverOne(d.deviceToken, d.environment as 'production' | 'sandbox', payload).then((r) => ({
          deviceId: d.id,
          deviceToken: d.deviceToken,
          ...r,
        })),
      ),
    );
    // 失败处理：increment failure / 410 直接清理
    await Promise.all(
      results
        .filter((r) => !r.delivered && r.deviceId !== 'inline')
        .map((r) => this.handleDeliveryFailure(r.deviceId, r.deviceToken, r.reason)),
    );

    const anyDelivered = results.find((r) => r.delivered);
    if (anyDelivered) {
      return { delivered: true, messageId: anyDelivered.messageId };
    }
    return { delivered: false, reason: results[0]?.reason ?? 'unknown' };
  }

  async sendPushBatch(items: Array<{
    userId: string;
    title: string;
    body: string;
    category?: string;
    customData?: Record<string, unknown>;
    deviceToken?: string;
  }>): Promise<{ delivered: number; failed: number }> {
    const results = await Promise.allSettled(items.map((item) => this.sendPush(item)));
    let delivered = 0;
    let failed = 0;
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.delivered) delivered++;
      else failed++;
    }
    return { delivered, failed };
  }

  /** APNs 是否配置齐全 */
  private isApnsConfigured(): boolean {
    return !!(
      process.env.APNS_TEAM_ID &&
      process.env.APNS_KEY_ID &&
      process.env.APNS_AUTH_KEY &&
      process.env.APNS_BUNDLE_ID
    );
  }

  /** 构造 aps payload */
  private buildApsPayload(params: {
    title: string;
    body: string;
    category?: string;
    customData?: Record<string, unknown>;
  }): Record<string, unknown> {
    return {
      aps: {
        alert: { title: params.title, body: params.body },
        sound: 'default',
        'mutable-content': 1,
        category: params.category ?? 'default',
      },
      ...(params.customData ?? {}),
    };
  }

  /**
   * 投递单条到 APNs。
   */
  private async deliverOne(
    deviceToken: string,
    environment: 'production' | 'sandbox',
    payload: Record<string, unknown>,
  ): Promise<{ delivered: boolean; messageId?: string; reason?: string }> {
    try {
      const session = await this.getHttp2Client(environment);
      const jwt = this.getJwt();
      const bundleId = process.env.APNS_BUNDLE_ID as string;

      const body = JSON.stringify(payload);
      const stream = session.request({
        ':method': 'POST',
        ':path': `/3/device/${deviceToken}`,
        authorization: `bearer ${jwt}`,
        'apns-topic': bundleId,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body).toString(),
      });

      return await new Promise((resolve) => {
        let status = 0;
        let messageId: string | undefined;
        const chunks: Buffer[] = [];

        stream.on('response', (headers) => {
          status = (headers[':status'] as number) ?? 0;
          messageId = headers['apns-id'] as string | undefined;
        });
        stream.on('data', (c: Buffer) => chunks.push(c));
        stream.on('end', () => {
          if (status === 200) {
            resolve({ delivered: true, messageId });
          } else {
            let reason = `apns_status_${status}`;
            try {
              const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
              if (parsed?.reason) reason = parsed.reason;
            } catch {
              /* keep status */
            }
            resolve({ delivered: false, reason });
          }
        });
        stream.on('error', (err) => {
          this.logger.warn(`[APNs:stream] error: ${err.message}`);
          resolve({ delivered: false, reason: 'stream_error' });
        });

        stream.write(body);
        stream.end();
      });
    } catch (err: any) {
      this.logger.error(`[APNs] deliver error: ${err?.message ?? err}`);
      return { delivered: false, reason: 'apns_internal_error' };
    }
  }

  /** 失败处理：increment 计数 + 410 立刻清理 */
  private async handleDeliveryFailure(
    deviceId: string,
    deviceToken: string,
    reason?: string,
  ): Promise<void> {
    // Unregistered / BadDeviceToken → token 已经无效，直接删
    if (reason === 'Unregistered' || reason === 'BadDeviceToken') {
      await this.prisma.userDevice.delete({ where: { id: deviceId } }).catch(() => {});
      this.logger.log(`[Push] device removed userToken=${deviceToken.slice(0, 8)}... reason=${reason}`);
      return;
    }
    await this.prisma.userDevice
      .update({
        where: { id: deviceId },
        data: { failureCount: { increment: 1 }, lastFailureReason: reason ?? 'unknown' },
      })
      .catch(() => {});
  }

  // ====================================================================
  // JWT (ES256) 签发
  // ====================================================================

  /** 50 分钟 rotate；缓存命中直接返 */
  private getJwt(): string {
    const now = Date.now();
    if (this.jwtCache && this.jwtCache.expiresAt > now) {
      return this.jwtCache.token;
    }
    const teamId = process.env.APNS_TEAM_ID as string;
    const keyId = process.env.APNS_KEY_ID as string;
    const authKey = process.env.APNS_AUTH_KEY as string;

    const header = { alg: 'ES256', kid: keyId };
    const iat = Math.floor(now / 1000);
    const payload = { iss: teamId, iat };
    const headerB64 = base64Url(JSON.stringify(header));
    const payloadB64 = base64Url(JSON.stringify(payload));
    const signingInput = `${headerB64}.${payloadB64}`;

    // crypto.createSign + dsaEncoding=ieee-p1363 直接得到 JOSE 期望的 r||s 64 字节
    const signer = createSign('SHA256');
    signer.update(signingInput);
    const privateKey = createPrivateKey({ key: authKey, format: 'pem' });
    const signature = signer.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' });
    const sigB64 = base64UrlBuffer(signature);

    const token = `${signingInput}.${sigB64}`;
    this.jwtCache = { token, expiresAt: now + 50 * 60 * 1000 };
    return token;
  }

  // ====================================================================
  // HTTP/2 连接管理
  // ====================================================================
  private async getHttp2Client(
    environment: 'production' | 'sandbox',
  ): Promise<http2.ClientHttp2Session> {
    const existing = this.clients.get(environment);
    if (existing && !existing.closed && !existing.destroyed) {
      return existing;
    }
    const url =
      environment === 'sandbox'
        ? 'https://api.sandbox.push.apple.com:443'
        : 'https://api.push.apple.com:443';
    const session = http2.connect(url);
    session.on('error', (err) => {
      this.logger.warn(`[APNs:session/${environment}] error: ${err.message}`);
      session.close();
    });
    session.on('goaway', () => {
      this.logger.log(`[APNs:session/${environment}] received GOAWAY, will reconnect next request`);
    });
    session.on('close', () => {
      if (this.clients.get(environment) === session) this.clients.delete(environment);
    });
    this.clients.set(environment, session);
    return session;
  }

  async onModuleDestroy() {
    for (const session of this.clients.values()) {
      try {
        session.close();
      } catch {
        /* ignore */
      }
    }
    this.clients.clear();
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

// ---------------------- utils ----------------------
function base64Url(input: string): string {
  return base64UrlBuffer(Buffer.from(input, 'utf8'));
}
function base64UrlBuffer(buf: Buffer): string {
  return buf.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}
