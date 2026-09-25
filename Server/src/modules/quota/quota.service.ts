import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EntitlementService } from './entitlement.service';
import { localDateString, regionToTimezone } from '../../common/utils/region-timezone';

/// 免费用户每日查询次数
const FREE_DAILY_QUERY_LIMIT = 5;
/// Redis 计数 key TTL：36h（跨时区缓冲 + 自然天结束后保留 12h 便于排查）
const QUERY_COUNT_TTL_SEC = 36 * 3600;
/// 取不到用户 region 时的默认时区（主力市场在国内）
const DEFAULT_TZ = 'Asia/Shanghai';
/// regionCode 内存缓存 TTL：用户所在地不会频繁变化，5 分钟足够
const REGION_CACHE_TTL_MS = 5 * 60 * 1000;

export interface QuotaSnapshot {
  /** 当前请求是否允许 */
  allowed: boolean;
  /** 今日已用次数（仅对配额管控用户有意义；Unlimited 用户也累加便于运营观察）*/
  count: number;
  /** 今日上限：FREE_DAILY_QUERY_LIMIT 或 Infinity */
  limit: number;
  /** 剩余次数：Unlimited 用户始终为 Infinity */
  remaining: number;
  /** 是否被认定为 unlimited（Pro / 家庭 owner / 家庭成员）*/
  isUnlimited: boolean;
  /** 权益来源说明（排障用）*/
  source: string;
}

/**
 * V3 一期查询配额（S1-4）
 *
 *   免费用户：5 次/天（按 user，未登录用户走 throttler 而非本服务）
 *   个人 Pro：不限/天
 *   家庭 owner：不限/天
 *   家庭 member（owner 已付家庭套餐）：不限/天
 *
 * 计数存储：Redis key = `query_count:{userId}:{YYYYMMDD}`。
 *
 * 2026-09-07 复核修复两处：
 *  1. 自然天原来按 **服务器本地时间** 算，Railway 跑在 UTC，国内用户配额在早上 08:00 重置。
 *     现在按 user.regionCode 对应时区算，取不到时回退 Asia/Shanghai。
 *  2. 原来"先 check 后 increment"两步非原子，并发请求能突破每日上限。
 *     现在提供 reserveQueryQuota()：先原子 INCR 占位再判断，超限自动退还。
 *
 * Unlimited 用户也会累加计数（不会被拦），方便运营观察活跃度。
 */
@Injectable()
export class QuotaService {
  private readonly logger = new Logger(QuotaService.name);
  /** userId → { tz, at }，避免每次查询都读一次 users 表 */
  private readonly tzCache = new Map<string, { tz: string; at: number }>();

  constructor(
    private redis: RedisService,
    private prisma: PrismaService,
    private entitlement: EntitlementService,
  ) {}

  /**
   * 原子占用一次配额。**这是查询接口应该用的入口。**
   *
   * 先 INCR 占位再判断上限，杜绝并发穿透；超限时立刻退还并返回 allowed=false。
   * 业务执行失败时调用方应调 refundQueryQuota() 退还，避免白扣次数。
   */
  async reserveQueryQuota(userId: string): Promise<QuotaSnapshot> {
    const e = await this.entitlement.getUserEntitlement(userId);
    let count: number;
    try {
      count = await this.incrCount(userId);
    } catch (err) {
      // Redis 不可用时放行：配额是商业策略，不应该让计数组件故障阻断核心功能
      this.logger.warn(
        `[Quota] Redis 不可用，本次放行 userId=${userId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return this.snapshot(0, e, true);
    }

    if (e.isUnlimited) return this.snapshot(count, e, true);

    if (count > FREE_DAILY_QUERY_LIMIT) {
      // 已经 INCR 过了，超限必须退还，否则计数会被无限次失败尝试推高
      await this.refundQueryQuota(userId);
      return this.snapshot(FREE_DAILY_QUERY_LIMIT, e, false);
    }
    return this.snapshot(count, e, true);
  }

  /** 退还一次已占用的配额（业务失败 / 超限回滚）。不会退到负数。 */
  async refundQueryQuota(userId: string): Promise<void> {
    try {
      const client = this.redis.getClient();
      const key = await this.todayKey(userId);
      const left = await client.decr(key);
      if (left < 0) await client.set(key, '0', 'EX', QUERY_COUNT_TTL_SEC);
    } catch (err) {
      this.logger.warn(
        `[Quota] 退还配额失败 userId=${userId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * 检查是否允许本次查询。**仅检查不增加计数**。
   * 注意：check + increment 两步之间存在并发窗口，新代码请改用 reserveQueryQuota()。
   */
  async checkQueryQuota(userId: string): Promise<QuotaSnapshot> {
    const e = await this.entitlement.getUserEntitlement(userId);
    const count = await this.getTodayCount(userId);
    if (e.isUnlimited) return this.snapshot(count, e, true);
    return this.snapshot(count, e, count < FREE_DAILY_QUERY_LIMIT);
  }

  /**
   * 业务完成后累加。INCR + EXPIRE 保证自然天后自动清理。
   * 返回累加后的 snapshot。
   */
  async incrementQueryCount(userId: string): Promise<QuotaSnapshot> {
    const count = await this.incrCount(userId);
    const e = await this.entitlement.getUserEntitlement(userId);
    if (e.isUnlimited) return this.snapshot(count, e, true);
    return this.snapshot(count, e, count <= FREE_DAILY_QUERY_LIMIT);
  }

  /**
   * 一步到位：检查 → 拒绝 / 通过并累加。
   * 内部已改为原子实现，等价于 reserveQueryQuota()。
   */
  async consume(userId: string): Promise<QuotaSnapshot> {
    return this.reserveQueryQuota(userId);
  }

  // ------------------------------------------------------------------
  // 内部实现
  // ------------------------------------------------------------------

  private snapshot(
    count: number,
    e: { isUnlimited: boolean; source: string },
    allowed: boolean,
  ): QuotaSnapshot {
    if (e.isUnlimited) {
      return {
        allowed: true,
        count,
        limit: Number.POSITIVE_INFINITY,
        remaining: Number.POSITIVE_INFINITY,
        isUnlimited: true,
        source: e.source,
      };
    }
    return {
      allowed,
      count,
      limit: FREE_DAILY_QUERY_LIMIT,
      remaining: Math.max(0, FREE_DAILY_QUERY_LIMIT - count),
      isUnlimited: false,
      source: e.source,
    };
  }

  /** 原子自增当日计数并续期，返回自增后的值 */
  private async incrCount(userId: string): Promise<number> {
    const client = this.redis.getClient();
    const key = await this.todayKey(userId);
    const tx = client.multi();
    tx.incr(key);
    tx.expire(key, QUERY_COUNT_TTL_SEC);
    const results = await tx.exec();
    return (results?.[0]?.[1] as number) ?? 0;
  }

  private async getTodayCount(userId: string): Promise<number> {
    try {
      const v = await this.redis.get(await this.todayKey(userId));
      return v ? parseInt(v, 10) || 0 : 0;
    } catch {
      return 0;
    }
  }

  /**
   * 当日计数 key。按用户所在时区切自然天，避免 Railway（UTC）让国内用户
   * 在早上 08:00 而不是零点重置配额。
   */
  private async todayKey(userId: string): Promise<string> {
    const tz = await this.userTimezone(userId);
    const ymd = localDateString(new Date(), tz).replace(/-/g, '');
    return `query_count:${userId}:${ymd}`;
  }

  private async userTimezone(userId: string): Promise<string> {
    const now = Date.now();
    const cached = this.tzCache.get(userId);
    if (cached && now - cached.at < REGION_CACHE_TTL_MS) return cached.tz;

    let tz = DEFAULT_TZ;
    try {
      const u = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { regionCode: true, country: true },
      });
      const region = u?.regionCode || u?.country || null;
      // regionToTimezone 对未知 region 返回 'UTC'，这里改用国内默认更贴合主力用户
      const mapped = region ? regionToTimezone(region) : DEFAULT_TZ;
      tz = mapped === 'UTC' ? DEFAULT_TZ : mapped;
    } catch {
      // 查不到就用默认时区，不影响配额本身
    }
    this.tzCache.set(userId, { tz, at: now });
    // 简单防膨胀：超过 1 万条清空重建（配额调用量不大，粗粒度足够）
    if (this.tzCache.size > 10_000) this.tzCache.clear();
    return tz;
  }
}
