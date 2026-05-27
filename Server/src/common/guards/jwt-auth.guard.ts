import { Injectable, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * 每用户 isDisabled 状态的 in-memory 缓存
 *  - 高 QPS 下避免每次请求查 DB
 *  - TTL 60s：禁用动作生效最多延迟 1 分钟（管理后台体感可接受）
 *  - 上限 10k 用户；满则清理最旧的 1/4（粗略 LRU）
 *  - Pod 重启自动失效；多实例间不同步但每实例独立查 DB，TTL 后自动一致
 */
const TTL_MS = 60_000;
const MAX_CACHE = 10_000;
const cache = new Map<string, { isDisabled: boolean; reason: string | null; at: number }>();

function evictIfNeeded() {
  if (cache.size <= MAX_CACHE) return;
  // 删除最早写入的 1/4（Map 按插入顺序遍历）
  const toDelete = Math.ceil(MAX_CACHE / 4);
  let i = 0;
  for (const key of cache.keys()) {
    cache.delete(key);
    if (++i >= toDelete) break;
  }
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector, private prisma: PrismaService) {
    super();
  }

  /** 供 admin-users PUT /status 调用：禁用/解封后立即让缓存失效，避免 60s 延迟 */
  static invalidateUser(userId: string): void {
    cache.delete(userId);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    // 1) JWT 签名校验
    const ok = (await super.canActivate(context)) as boolean;
    if (!ok) return false;
    // 2) 被禁用账号拦截（走缓存，TTL 60s）
    const req = context.switchToHttp().getRequest();
    const userId: string | undefined = req?.user?.sub || req?.user?.userId || req?.user?.id;
    if (!userId) return true;

    const now = Date.now();
    const cached = cache.get(userId);
    let entry: { isDisabled: boolean; reason: string | null };
    if (cached && now - cached.at < TTL_MS) {
      entry = { isDisabled: cached.isDisabled, reason: cached.reason };
    } else {
      const u = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { isDisabled: true, disabledReason: true },
      });
      entry = { isDisabled: !!u?.isDisabled, reason: u?.disabledReason ?? null };
      cache.set(userId, { ...entry, at: now });
      evictIfNeeded();
    }
    if (entry.isDisabled) {
      throw new ForbiddenException({
        code: 'account_disabled',
        message: entry.reason || '账号已被禁用，请联系客服',
      });
    }
    return true;
  }
}
