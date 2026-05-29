import { Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { EntitlementService } from './entitlement.service';

/// 免费用户每日查询次数
const FREE_DAILY_QUERY_LIMIT = 5;
/// Redis 计数 key TTL：36h（跨时区缓冲 + 自然天结束后保留 12h 便于排查）
const QUERY_COUNT_TTL_SEC = 36 * 3600;

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
 * 计数存储：Redis key = `query_count:{userId}:{YYYYMMDD}`，按服务器自然天
 * （S3 会改为按 user.regionCode 时区；当前与现有 cron / broadcast 行为一致）
 *
 * Unlimited 用户也会累加计数（不会被拦），方便运营观察活跃度。
 */
@Injectable()
export class QuotaService {
  constructor(
    private redis: RedisService,
    private entitlement: EntitlementService,
  ) {}

  /**
   * 检查是否允许本次查询。**仅检查不增加计数**。
   * 调用方应在查询业务成功后调用 incrementQueryCount 累加。
   */
  async checkQueryQuota(userId: string): Promise<QuotaSnapshot> {
    const e = await this.entitlement.getUserEntitlement(userId);
    const count = await this.getTodayCount(userId);
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
    const remaining = Math.max(0, FREE_DAILY_QUERY_LIMIT - count);
    return {
      allowed: count < FREE_DAILY_QUERY_LIMIT,
      count,
      limit: FREE_DAILY_QUERY_LIMIT,
      remaining,
      isUnlimited: false,
      source: e.source,
    };
  }

  /**
   * 业务完成后累加。INCR + EXPIRE 保证自然天后自动清理。
   * 返回累加后的 snapshot。
   */
  async incrementQueryCount(userId: string): Promise<QuotaSnapshot> {
    const client = this.redis.getClient();
    const key = this.todayKey(userId);
    const tx = client.multi();
    tx.incr(key);
    tx.expire(key, QUERY_COUNT_TTL_SEC);
    const results = await tx.exec();
    const count = (results?.[0]?.[1] as number) ?? 0;

    const e = await this.entitlement.getUserEntitlement(userId);
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
    const remaining = Math.max(0, FREE_DAILY_QUERY_LIMIT - count);
    return {
      allowed: count <= FREE_DAILY_QUERY_LIMIT,
      count,
      limit: FREE_DAILY_QUERY_LIMIT,
      remaining,
      isUnlimited: false,
      source: e.source,
    };
  }

  /**
   * 一步到位：检查 → 拒绝 / 通过并累加。
   * 调用方拿到 snapshot 就直接根据 allowed 决定。
   */
  async consume(userId: string): Promise<QuotaSnapshot> {
    const pre = await this.checkQueryQuota(userId);
    if (!pre.allowed) return pre;
    return this.incrementQueryCount(userId);
  }

  private async getTodayCount(userId: string): Promise<number> {
    const v = await this.redis.get(this.todayKey(userId));
    return v ? parseInt(v, 10) || 0 : 0;
  }

  private todayKey(userId: string): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `query_count:${userId}:${y}${m}${d}`;
  }
}
