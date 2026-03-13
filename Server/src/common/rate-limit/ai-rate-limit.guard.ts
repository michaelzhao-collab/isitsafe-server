/**
 * 对 /api/ai/analyze 做限流：
 * - 每分钟 20 次（防刷）
 * - 免费用户每日 5 次（ai:query:{userId}:{date}），会员无每日限制
 */
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisService } from '../../redis/redis.service';
import { MembershipService } from '../../modules/membership/membership.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

const PREFIX_MINUTE = 'rate:ai:';
const PREFIX_DAY = 'ai:query:';
const TTL_MINUTE = 60;
const MAX_PER_MINUTE = 20;
// 临时放宽：联调阶段关闭每日免费次数限制（设为一个极大值）
const MAX_FREE_PER_DAY = Number.MAX_SAFE_INTEGER;

function dateKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

@Injectable()
export class AiRateLimitGuard implements CanActivate {
  constructor(
    private redis: RedisService,
    private reflector: Reflector,
    private membership: MembershipService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.sub as string | undefined;
    const ip = request.ip || request.connection?.remoteAddress || 'unknown';

    const client = this.redis.getClient();

    const minuteKey = `${PREFIX_MINUTE}${userId ?? ip}`;
    const minuteCount = await client.incr(minuteKey);
    if (minuteCount === 1) await client.expire(minuteKey, TTL_MINUTE);
    if (minuteCount > MAX_PER_MINUTE) {
      throw new HttpException(
        { message: 'AI 分析请求过于频繁，请稍后再试' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const dayIdentifier = userId ? `u:${userId}` : `ip:${ip}`;
    const dayKey = `${PREFIX_DAY}${dayIdentifier}:${dateKey()}`;
    const isPremium = userId ? await this.membership.isPremiumByUserId(userId) : false;
    if (!isPremium) {
      const dayCount = await client.incr(dayKey);
      if (dayCount === 1) await client.expire(dayKey, 86400 * 2);
      if (dayCount > MAX_FREE_PER_DAY) {
        throw new HttpException(
          { message: '今日免费次数已用完，开通会员可无限使用' },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
    return true;
  }
}
