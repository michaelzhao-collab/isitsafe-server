import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * 仅海外可访问的资源 Guard（V3 一期专用于 F 模块）
 *
 * 规则：拒绝 user.region_code 以 'CN' 开头的请求；regionCode 为 null
 * 兜底放行（GeoIP 失效时不应拒绝），后续 S5 可改严格白名单。
 *
 * 必须在 JwtAuthGuard 之后使用：
 *   @UseGuards(JwtAuthGuard, OverseaOnlyGuard)
 *
 * 缓存：60s in-memory，避免每个 breach 请求都查 user 表。失效时刻 = 用户主动
 * 修改 region（一期暂无入口，cron geoip 也只在初次填充时更新）。
 */
const TTL_MS = 60_000;
const MAX_CACHE = 10_000;
const regionCache = new Map<string, { region: string | null; at: number }>();

function evictIfNeeded() {
  if (regionCache.size <= MAX_CACHE) return;
  const toDelete = Math.ceil(MAX_CACHE / 4);
  let i = 0;
  for (const key of regionCache.keys()) {
    regionCache.delete(key);
    if (++i >= toDelete) break;
  }
}

@Injectable()
export class OverseaOnlyGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  /** 用户改 region 时主动失效（一期无此入口，S5 加 user 端 region 切换时会用到）*/
  static invalidateUser(userId: string): void {
    regionCache.delete(userId);
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const userId: string | undefined =
      req?.user?.sub || req?.user?.userId || req?.user?.id;
    if (!userId) {
      // 没登录：JwtAuthGuard 应已拦截；防御性允许（后续 super.canActivate 401）
      return true;
    }

    const now = Date.now();
    const cached = regionCache.get(userId);
    let region: string | null;
    if (cached && now - cached.at < TTL_MS) {
      region = cached.region;
    } else {
      const u = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { regionCode: true },
      });
      region = u?.regionCode ?? null;
      regionCache.set(userId, { region, at: now });
      evictIfNeeded();
    }

    if (region && region.toUpperCase().startsWith('CN')) {
      throw new ForbiddenException({
        code: 'region_not_supported',
        message: 'This feature is only available outside mainland China',
      });
    }
    return true;
  }
}
