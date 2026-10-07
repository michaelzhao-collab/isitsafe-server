import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { FamilyService } from '../family/family.service';
import { FamilyEventService } from '../chat/family-event.service';
import { normalizeByType } from '../../common/utils/content-normalize';
import { hostOf, extractUrls } from '../ai/contact-guard';

/** URL 的路径部分（小写、去末尾斜杠；无路径返回 '/'） */
function pathOf(url: string): string {
  const raw = (url ?? '').trim();
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
    const p = (u.pathname || '/').toLowerCase();
    return p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p;
  } catch {
    return '/';
  }
}

const CACHE_PREFIX = 'query:';

/** 两级公共后缀（没有 psl 依赖，只列常见的；其余按「最后两段」算可注册域名） */
const TWO_LEVEL_PUBLIC_SUFFIXES = new Set([
  'com.cn', 'net.cn', 'org.cn', 'gov.cn', 'edu.cn', 'ac.cn', 'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'me.uk',
  'com.au', 'net.au', 'org.au', 'gov.au', 'com.hk', 'org.hk', 'gov.hk', 'com.tw', 'org.tw', 'gov.tw', 'com.sg', 'gov.sg',
  'co.jp', 'ne.jp', 'or.jp', 'co.kr', 'com.br', 'com.my', 'co.nz', 'com.tr', 'co.in', 'co.za', 'com.mx', 'com.ar',
]);

/** 可注册域名：m.evil.cn → evil.cn；a.b.icbc.com.cn → icbc.com.cn */
export function registrableDomain(host: string): string {
  const labels = (host || '').toLowerCase().split('.').filter(Boolean);
  if (labels.length <= 2) return labels.join('.');
  const lastTwo = labels.slice(-2).join('.');
  return TWO_LEVEL_PUBLIC_SUFFIXES.has(lastTwo) ? labels.slice(-3).join('.') : lastTwo;
}

/** 供 admin 后台删缓存用：与 cacheKey() 口径一致 */
export function queryCacheKey(type: string, content: string): string {
  const key =
    type === 'phone' || type === 'url'
      ? normalizeByType(type as 'phone' | 'url', content) || content
      : content;
  return `${CACHE_PREFIX}${type}:${key}`;
}
const CACHE_TTL = 300; // 5 分钟（admin 更新风险库后最多 5 分钟生效）

/** 命中不了任何风险记录时的统一返回体 */
const EMPTY_RESULT = { risk_level: 'low' as const, tags: [] as unknown[], records: [] as unknown[] };

/**
 * 输入是否值得拿去查风险库（2026-09-07 复核修复）。
 *
 * 风险库匹配用的是 `contains`，空串会退化成 `ILIKE '%%'` 命中全表并把记录吐出去，
 * 还会顺带触发家庭播报。控制器层已有 DTO 校验，这里是服务层兜底 ——
 * ai.service 会用抽取出来的 URL 直接调 queryUrl()，抽取失败时可能是空串。
 *
 * 注意：这里 **不抛异常**，只返回 false 让调用方拿到空结果。
 * 内部调用（AI 分析流程）不应该因为一次抽取失败就整体报错。
 */
function isUsableQueryContent(type: 'phone' | 'url' | 'company', content: string): boolean {
  const s = (content || '').trim();
  if (!s) return false;
  if (type === 'phone') {
    // 至少 5 位数字，与 PhoneQueryDto 保持一致
    return (s.match(/\d/g) || []).length >= 5;
  }
  if (type === 'url') {
    return s.length >= 4 && /\S\.\S{2,}/.test(s);
  }
  return s.length >= 2;
}

/**
 * 构造风险库匹配用的候选串（2026-09-07 复核修复）。
 *
 * 风险库里的号码存的是 '+86 13800138000' 这种带空格的原始写法，
 * 所以既不能只用用户原文（'+8613800138000' 匹配不上），也不能改成规范化后精确匹配
 * （库里存量数据格式不统一，会把现在能查到的都查不到）。
 *
 * 折中：原文 + E.164 + 纯数字国内段 三者取并集做 contains，
 * 是现有行为的超集，不会让原本能命中的查询失效。
 */
function matchCandidates(type: 'phone' | 'url' | 'company', content: string): string[] {
  const raw = (content || '').trim();
  const set = new Set<string>([raw]);
  if (type === 'phone') {
    const e164 = normalizeByType('phone', raw);
    if (e164) {
      set.add(e164);
      // 去掉 "+国家码" 之后的本地号段：'+8613800138000' → '13800138000'
      const digits = e164.replace(/\D/g, '');
      if (digits.length > 10) set.add(digits.slice(-11));
      else if (digits) set.add(digits);
    }
  } else if (type === 'url') {
    const normalized = normalizeByType('url', raw);
    if (normalized) set.add(normalized);
    try {
      set.add(new URL(/^[a-z][a-z0-9+\-.]*:\/\//i.test(raw) ? raw : `https://${raw}`).hostname);
    } catch {
      // 不是合法 URL 就只用原文
    }
  }
  return [...set].filter((s) => s.length >= 2);
}

@Injectable()
export class QueryService {
  private readonly logger = new Logger(QueryService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private family: FamilyService,
    private familyEvent: FamilyEventService,
  ) {}

  /**
   * 缓存 key 用归一化后的内容：'+86 138…' 与 '138…' 命中同一条缓存，
   * 与下面 matchCandidates 的并集匹配口径保持一致（结果本来就相同）。
   */
  private cacheKey(type: string, content: string): string {
    return queryCacheKey(type, content);
  }

  async queryPhone(phone: string, userId?: string, imCapable = false) {
    if (!isUsableQueryContent('phone', phone)) return { ...EMPTY_RESULT };
    const cached = await this.redis.get(this.cacheKey('phone', phone));
    const result = cached
      ? JSON.parse(cached)
      : await this.lookupAndCache('phone', phone);
    this.maybeAutoBroadcast({
      userId,
      contentType: 'phone',
      content: phone,
      result,
      imCapable,
    });
    return result;
  }

  async queryUrl(url: string, userId?: string, imCapable = false) {
    console.log('[QUERY_URL] 输入 content=' + JSON.stringify(url?.slice(0, 200)) + ' （本接口仅查风险库，不调用豆包）');
    // 内部调用（ai.service 抽取 URL 失败）可能传空串，直接返回低风险，不查库不播报
    if (!isUsableQueryContent('url', url)) {
      console.log('[QUERY_URL] 输入无效，跳过风险库查询');
      return { ...EMPTY_RESULT };
    }
    const cached = await this.redis.get(this.cacheKey('url', url));
    if (cached) {
      const result = JSON.parse(cached);
      console.log('[QUERY_URL] 命中缓存 risk_level=' + result.risk_level + ' recordsCount=' + (result.records?.length ?? 0));
      this.maybeAutoBroadcast({ userId, contentType: 'url', content: url, result, imCapable });
      return result;
    }
    const result = await this.lookupAndCache('url', url, true);
    this.maybeAutoBroadcast({ userId, contentType: 'url', content: url, result, imCapable });
    return result;
  }

  async queryCompany(name: string, userId?: string) {
    if (!isUsableQueryContent('company', name)) return { ...EMPTY_RESULT };
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
    const candidates = matchCandidates(type, content);
    // 2026-10-07 复核 P1-13：URL 原来用「库行 contains 查询串」，方向反了——
    // 查 apple.com 会命中库里的 apple.com-verify.cn（官网被判 high），而库里存 evil.cn 查 m.evil.cn 却不命中。
    // 现在：按可注册域名粗取（contains 仅做缩小范围），再在内存里按「主机名相等或为其子域」精确过滤。
    const urlHost = type === 'url' ? hostOf(content) : '';
    const urlRegistrable = urlHost ? registrableDomain(urlHost) : '';
    // 粗取：可注册域名 + 原有候选（原串 / 归一化串 / 主机名）。IDN 行（诈骗.中国）存的是原文，punycode 对不上，所以原串也要在候选里
    const coarse = Array.from(new Set([...(urlRegistrable ? [urlRegistrable] : []), ...candidates])).filter((c) => c.length >= 2);
    const whereOr = coarse.map((c) => ({ content: { contains: c, mode: 'insensitive' as const } }));
    let items = await this.prisma.riskData.findMany({
      where: { type, OR: whereOr },
      take: 50,
    });
    if (type === 'url' && urlHost) {
      const qPath = pathOf(content);
      items = items.filter((row) => {
        const rowContent = String(row.content ?? '').trim();
        // 行内容可能带备注（「evil8.cn 这是个钓鱼站」）：取其中第一个链接
        const rowUrl = hostOf(rowContent) ? rowContent : (extractUrls(rowContent, 1)[0] ?? '');
        const rowHost = hostOf(rowUrl);
        if (!rowHost) return rowContent.toLowerCase() === content.trim().toLowerCase();
        const hostMatch = urlHost === rowHost || urlHost.endsWith('.' + rowHost);
        if (!hostMatch) return false;
        // 复核 P1-1：行带路径（bit.ly/scam123、docs.google.com/forms/d/x）只覆盖该路径前缀，不能把整个短链 / 网盘主机判成 high
        const rowPath = pathOf(rowUrl);
        if (rowPath && rowPath !== '/') return qPath === rowPath || qPath.startsWith(rowPath.endsWith('/') ? rowPath : rowPath + '/') || qPath.startsWith(rowPath);
        return true;
      });
    }
    if (type === 'phone') {
      // 复核 P0-1：phone 原来是 contains，「50000」会命中 13950000123。改成去非数字后相等；都 ≥11 位时比较末 11 位（+86 前缀差异）
      const qd = content.replace(/\D/g, '');
      items = items.filter((row) => {
        const rd = String(row.content ?? '').replace(/\D/g, '');
        if (!rd || !qd) return false;
        if (rd === qd) return true;
        return rd.length >= 11 && qd.length >= 11 && rd.slice(-11) === qd.slice(-11);
      });
    }
    // 多条命中取最高等级（原来 findMany 无排序，items[0] 是随机的一条）
    const rank: Record<string, number> = { high: 3, medium: 2, low: 1 };
    items.sort((a, b) => (rank[b.riskLevel] ?? 0) - (rank[a.riskLevel] ?? 0));
    const result = {
      risk_level: items.length ? (items[0].riskLevel as 'high' | 'medium' | 'low') : 'low',
      tags: items.flatMap((i) => (Array.isArray(i.tags) ? i.tags : [])),
      records: items.slice(0, 20),
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
    imCapable?: boolean;
  }): void {
    if (!params.userId) return;
    if (params.result.risk_level !== 'high') return;

    const userId = params.userId;
    const result = params.result;

    // V5.1 版本门控：只有新版客户端触发的查询才写 IM 群聊卡片。
    // 老版本触发 → 跳过（不写 family_events/family_messages、不发信号），只走下方旧 broadcast，
    // 保证服务端部署对老用户零行为变化。CHAT_ENABLED=false 时 isImCapableRequest 恒 false，全局熔断。
    if (params.imCapable) {
      this.familyEvent
        .autoBroadcastRiskAlert(userId, {
          title: maskForFamily(params.contentType, params.content),
          summary: 'AI 判定高风险，请不要按对方要求操作、不要转账。',
          riskLevel: 'high',
          // 2026-09-07 复核修复：refId 原来直接拼原始输入，'+86 139…' 与 '139…'
          // 被当成两个不同目标，24h 去重失效 → 家人重复收到同一号码的播报卡。
          // 与旧 broadcast 的 content_hash 一样走 normalizeByType，两条路径口径统一。
          refId: `${params.contentType}:${
            normalizeByType(params.contentType, params.content) || params.content
          }`,
        })
        .catch((err) => this.logger.warn(`[AutoBroadcastCard] failed: ${err?.message ?? err}`));
    }

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
