import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { FamilyService } from '../family/family.service';

const CACHE_PREFIX = 'query:';
const CACHE_TTL = 300; // 5 分钟（admin 更新风险库后最多 5 分钟生效）

@Injectable()
export class QueryService {
  private readonly logger = new Logger(QueryService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private family: FamilyService,
  ) {}

  private cacheKey(type: string, content: string): string {
    return `${CACHE_PREFIX}${type}:${content}`;
  }

  async queryPhone(phone: string, userId?: string) {
    const cached = await this.redis.get(this.cacheKey('phone', phone));
    const result = cached
      ? JSON.parse(cached)
      : await this.lookupAndCache('phone', phone);
    this.maybeAutoBroadcast({
      userId,
      contentType: 'phone',
      content: phone,
      result,
    });
    return result;
  }

  async queryUrl(url: string, userId?: string) {
    console.log('[QUERY_URL] 输入 content=' + JSON.stringify(url?.slice(0, 200)) + ' （本接口仅查风险库，不调用豆包）');
    const cached = await this.redis.get(this.cacheKey('url', url));
    if (cached) {
      const result = JSON.parse(cached);
      console.log('[QUERY_URL] 命中缓存 risk_level=' + result.risk_level + ' recordsCount=' + (result.records?.length ?? 0));
      this.maybeAutoBroadcast({ userId, contentType: 'url', content: url, result });
      return result;
    }
    const result = await this.lookupAndCache('url', url, true);
    this.maybeAutoBroadcast({ userId, contentType: 'url', content: url, result });
    return result;
  }

  async queryCompany(name: string, userId?: string) {
    const cached = await this.redis.get(this.cacheKey('company', name));
    if (cached) return JSON.parse(cached);
    return this.lookupAndCache('company', name);
    // 注：company 不映射到 family_broadcast.content_type（PRD 枚举为 phone|url|sms|voice），不自动广播
  }

  /** 抽出来的统一查询 + 缓存逻辑 */
  private async lookupAndCache(
    type: 'phone' | 'url' | 'company',
    content: string,
    verboseLog = false,
  ) {
    const items = await this.prisma.riskData.findMany({
      where: { type, content: { contains: content, mode: 'insensitive' } },
      take: 20,
    });
    const result = {
      risk_level: items.length ? (items[0].riskLevel as 'high' | 'medium' | 'low') : 'low',
      tags: items.flatMap((i) => (Array.isArray(i.tags) ? i.tags : [])),
      records: items,
    };
    if (verboseLog) {
      console.log(
        '[QUERY_URL] 风险库查询 命中条数=' + items.length +
        ' risk_level=' + result.risk_level +
        ' 结论原因: ' + (items.length ? '库中存在该URL/域名相关风险记录' : '库中无匹配记录，故判为低风险'),
      );
    }
    await this.redis.set(this.cacheKey(type, content), JSON.stringify(result), CACHE_TTL);
    return result;
  }

  /**
   * S2-3：高风险自动以官方名义广播到家庭
   *
   * 触发条件：
   *  - 登录用户（userId 必有）
   *  - 结果 risk_level === 'high'
   *  - 调用方为 phone/url（company 不在 PRD content_type 枚举内）
   *
   * 行为：fire-and-forget，不阻塞 query 返回。
   * 失败（无家庭/重复/配额/隐私关）由 createBroadcast 内部静默处理。
   */
  private maybeAutoBroadcast(params: {
    userId?: string;
    contentType: 'phone' | 'url';
    content: string;
    result: { risk_level: string; tags: unknown[]; records: unknown[] };
  }): void {
    if (!params.userId) return;
    if (params.result.risk_level !== 'high') return;

    const userId = params.userId;
    const result = params.result;

    // 不 await：让 query 立即返回；fire-and-forget
    this.family
      .createBroadcast({
        triggeredByUserId: userId,
        contentType: params.contentType,
        content: params.content,
        source: 'auto_query',
        classifier: async () => ({
          label: 'scam',
          contentDisplay: maskForFamily(params.contentType, params.content),
          resultDetail: {
            confidence: 0.9,
            features: (result.tags ?? [])
              .filter((t): t is string => typeof t === 'string')
              .slice(0, 5),
            hitCount: Array.isArray(result.records) ? result.records.length : 0,
            advice: ['不要按对方说的做', '不要回拨/转账', '如已转账请立刻拨打 96110'],
            triggerType: 'query_risk_db_hit',
          },
        }),
      })
      .then((r) => {
        if (r.skipReason && r.skipReason !== 'duplicate') {
          this.logger.log(
            `[AutoBroadcast] userId=${userId} type=${params.contentType} skip=${r.skipReason}`,
          );
        }
      })
      .catch((err) => {
        this.logger.warn(`[AutoBroadcast] fire-and-forget failed: ${err?.message ?? err}`);
      });
  }

  async queryBatch(requests: { type: 'phone' | 'url' | 'company'; content: string }[]) {
    const results = await Promise.all(
      requests.map(async (r) => {
        if (r.type === 'phone') return this.queryPhone(r.content);
        if (r.type === 'url') return this.queryUrl(r.content);
        return this.queryCompany(r.content);
      }),
    );
    return results;
  }

  async getTags() {
    const cached = await this.redis.get(CACHE_PREFIX + 'tags');
    if (cached) return JSON.parse(cached);
    const data = await this.prisma.riskData.findMany({ select: { tags: true } });
    const set = new Set<string>();
    data.forEach((d) => {
      const arr = Array.isArray(d.tags) ? d.tags : [];
      arr.forEach((t: string) => set.add(t));
    });
    const tags = Array.from(set);
    await this.redis.set(CACHE_PREFIX + 'tags', JSON.stringify(tags), CACHE_TTL * 24);
    return tags;
  }
}

/** 脱敏：手机号中间 4 位打码；URL 保留 host + 短路径 */
function maskForFamily(type: 'phone' | 'url', content: string): string {
  const s = content.trim();
  if (type === 'phone') {
    return s.replace(/(\d{3})\d{4}(\d{2,4})/g, '$1****$2');
  }
  try {
    const u = new URL(s.startsWith('http') ? s : `https://${s}`);
    const path = u.pathname.length > 12 ? u.pathname.slice(0, 12) + '…' : u.pathname;
    return `${u.host}${path}`;
  } catch {
    return s.length > 60 ? s.slice(0, 60) + '…' : s;
  }
}
