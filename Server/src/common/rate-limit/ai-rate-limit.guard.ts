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
import { clientIp } from '../client-ip.util';
import { RedisService } from '../../redis/redis.service';
import { MembershipService } from '../../modules/membership/membership.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AI_V2 } from '../ai-flags';

const PREFIX_MINUTE = 'rate:ai:';
const PREFIX_DAY = 'ai:query:';
const TTL_MINUTE = 60;
const MAX_PER_MINUTE = 20;
/** 从环境变量 FREE_DAILY_LIMIT 读取，Railway 可直接配置，默认 5 */
const MAX_FREE_PER_DAY = Number(process.env.FREE_DAILY_LIMIT ?? '5');

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
    const ip = clientIp(request); // 2026-09-27 复核：真实客户端 IP，否则全站共用一个桶

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
      if (AI_V2) {
        // ValidationPipe 在 guard 之后才跑：content 缺失 / 为空的请求会 400，此时服务层没机会退回额度，所以这里先粗查，不合法就不占位直接放行给 pipe 报 400
        const body = request.body ?? {};
        if (typeof body.content !== 'string' || !body.content.trim()) return true;
        // 2026-10-06 V2：打招呼、知识问答、调用失败不算次数；2026-10-07 复核 P2-B：原来「只读不写、成功后再加」
        // 在模型返回前的 ~5 秒里并发 20 条全部放行（单日实际约 24 次）。现在进门先 +1 占位，
        // AiService 在结果不该计数（闲聊 / 知识 / 失败 / 抛错）时再 -1 退回。
        const dayCount = await client.incr(dayKey);
        if (dayCount === 1) await client.expire(dayKey, 86400 * 2);
        if (dayCount > MAX_FREE_PER_DAY) {
          await client.decr(dayKey);
          throw new HttpException(
            // code 10006：客户端据此区分「今日额度用完」与「每分钟限流 / 全站限流」（iOS 原来把所有 429 都当额度用完）
            { message: '今日免费次数已用完，开通会员可无限使用', code: 10006 },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
        request.aiQuotaKey = dayKey;
        return true;
      }
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
