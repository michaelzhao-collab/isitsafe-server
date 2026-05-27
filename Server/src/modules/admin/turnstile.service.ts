import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import axios from 'axios';

/**
 * Cloudflare Turnstile 人机验证
 *  - 前端用 Site Key 调出 widget，用户通过后拿到 token
 *  - 后端用 Secret Key 调 Cloudflare 验证 token
 *
 * 配置：
 *  - TURNSTILE_SECRET   后端密钥（必填，未配置则跳过验证 — 兼容老登录流程）
 *  - TURNSTILE_SITE_KEY 前端站点 key（前端 .env 配 VITE_TURNSTILE_SITE_KEY）
 *
 * 文档：https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */
@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);
  private readonly VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

  /**
   * 校验 Turnstile token
   * @param token 前端 widget 拿到的 cf-turnstile-response
   * @param remoteIp 可选，用户 IP（用于增加风控信号）
   * @throws UnauthorizedException 验证失败
   */
  async verify(token: string | undefined, remoteIp?: string): Promise<void> {
    const secret = process.env.TURNSTILE_SECRET;
    // 未配置 secret 时跳过验证（兼容尚未配 Turnstile 的环境，便于平滑上线）
    if (!secret) {
      this.logger.warn('[Turnstile] TURNSTILE_SECRET not configured, skipping verification');
      return;
    }
    if (!token?.trim()) {
      throw new UnauthorizedException('请完成人机验证');
    }
    try {
      const form = new URLSearchParams();
      form.append('secret', secret);
      form.append('response', token);
      if (remoteIp) form.append('remoteip', remoteIp);
      const resp = await axios.post(this.VERIFY_URL, form, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 8000,
      });
      const data = resp.data as { success?: boolean; 'error-codes'?: string[] };
      if (!data.success) {
        this.logger.warn(`[Turnstile] verify failed: ${(data['error-codes'] || []).join(',')}`);
        throw new UnauthorizedException('人机验证失败，请重试');
      }
    } catch (err: any) {
      if (err instanceof UnauthorizedException) throw err;
      this.logger.error(`[Turnstile] verify request failed: ${err?.message}`);
      // 网络异常：保守拒绝，避免暴破利用网络抖动绕过
      throw new UnauthorizedException('人机验证服务暂不可用，请稍后再试');
    }
  }
}
