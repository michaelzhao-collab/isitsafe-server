import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { clientIp } from '../client-ip.util';

/**
 * 全局限流守卫（2026-09-27 复核修复）。
 *
 * 之前 ThrottlerModule 只注册未挂 APP_GUARD，等于零限流：登录可无限刷账号、
 * admin 密码可暴破、匿名 AI 接口可白嫖。现在挂成全局守卫。
 *
 * 两处定制：
 *  - getTracker：用真实客户端 IP（见 client-ip.util），否则 Railway 上全站一个桶。
 *  - 健康检查等根路径跳过（Railway 探活频率高，不该被限）。
 */
@Injectable()
export class CfThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    return clientIp(req);
  }

  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    // 只对 HTTP 生效；WS 升级、cron 等非 HTTP 上下文直接跳过
    if (context.getType() !== 'http') return true;
    const req = context.switchToHttp().getRequest();
    const path: string = req?.originalUrl || req?.url || '';
    // 健康检查与 Universal Link 验证文件不限流
    if (path === '/api/health' || path.startsWith('/.well-known/')) return true;
    return false;
  }

  protected throwThrottlingException(): Promise<void> {
    throw new ThrottlerException('请求过于频繁，请稍后再试');
  }
}
