/**
 * V3-K AI 内容抓取源配置（V2：换 Google News RSS 聚合）
 *
 * V1 教训：直接抓 FTC / IC3 / BBB / 国内警察网都被 403 / 404
 * - 政府站点反爬强（UA + IP 双过滤）
 * - 部分 RSS URL 已变更
 *
 * V2 方案：用 Google News RSS 搜索接口聚合
 *   `https://news.google.com/rss/search?q=<keywords>&hl=<lang>&gl=<region>&ceid=<region:lang>`
 * 优势：
 *   - 不需要 selector，标准 RSS
 *   - 聚合全网（FTC、BBB、警察网、主流媒体都在结果里）
 *   - 不容易被 ban（Google 用户量大）
 *   - 支持时间过滤 `when:7d`（最近 7 天）和 `when:14d`
 *   - 按 q= 调整关键词即可控制 intel vs knowledge
 *
 * 关键词策略：
 *   - intel  → "scam OR fraud OR phishing"（趋势 / 新手段 / 警示）+ 反诈/诈骗/警惕
 *   - knowledge → "scam victim OR scam case OR arrested" + 诈骗案/受害/被骗
 */

export type SourceCategory = 'intel' | 'knowledge';
export type SourceKind = 'rss' | 'html';

export interface SourceConfig {
  key: string;
  name: string;
  category: SourceCategory;
  kind: SourceKind;
  url: string;
  language: 'zh' | 'en';
  html?: {
    itemSelector: string;
    titleSelector: string;
    linkSelector: string;
    linkAttr?: string;
    summarySelector?: string;
    dateSelector?: string;
    baseUrl?: string;
  };
  userAgent?: string;
  timeoutMs?: number;
  maxItems?: number;
}

const UA_BROWSER =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

/** 构造 Google News RSS URL */
function gnews(opts: {
  q: string;
  lang: 'zh' | 'en';
  region: 'US' | 'GB' | 'AU' | 'CN' | 'HK';
  whenDays?: number;
}): string {
  const when = opts.whenDays ?? 14;
  // q 里的 when:Xd 限定时间窗
  const query = `${opts.q} when:${when}d`;
  const hl = opts.lang === 'zh' ? 'zh-CN' : 'en-US';
  const langInCeid = opts.lang === 'zh' ? 'zh-Hans' : 'en';
  return (
    `https://news.google.com/rss/search?q=${encodeURIComponent(query)}` +
    `&hl=${hl}&gl=${opts.region}&ceid=${opts.region}:${langInCeid}`
  );
}

export const SOURCES: SourceConfig[] = [
  // ============================================================
  // 英文 — 情报（趋势 / 新型手段 / 警示）
  // ============================================================
  {
    key: 'gnews_en_us_scam_trends',
    name: 'Google News (US) - scam trends',
    category: 'intel',
    kind: 'rss',
    url: gnews({
      q: '("new scam" OR "scam alert" OR "phishing" OR "fraud warning") -football -movie',
      lang: 'en',
      region: 'US',
      whenDays: 10,
    }),
    language: 'en',
    maxItems: 5,
    userAgent: UA_BROWSER,
  },
  {
    key: 'gnews_en_au_scam_trends',
    name: 'Google News (AU) - scam trends',
    category: 'intel',
    kind: 'rss',
    url: gnews({
      q: '"scam" OR "fraud" "warning"',
      lang: 'en',
      region: 'AU',
      whenDays: 10,
    }),
    language: 'en',
    maxItems: 5,
    userAgent: UA_BROWSER,
  },

  // ============================================================
  // 英文 — 案例（具体真实事件 / 受害人 / 警方破案）
  // ============================================================
  {
    key: 'gnews_en_us_scam_cases',
    name: 'Google News (US) - scam cases',
    category: 'knowledge',
    kind: 'rss',
    url: gnews({
      q: '("scam victim" OR "lost to scam" OR "scammed out of" OR "scammer arrested") -football -movie',
      lang: 'en',
      region: 'US',
      whenDays: 10,
    }),
    language: 'en',
    maxItems: 5,
    userAgent: UA_BROWSER,
  },
  {
    key: 'gnews_en_uk_scam_cases',
    name: 'Google News (UK) - scam cases',
    category: 'knowledge',
    kind: 'rss',
    url: gnews({
      q: '("scam victim" OR "lost to scam" OR "fraudster jailed")',
      lang: 'en',
      region: 'GB',
      whenDays: 10,
    }),
    language: 'en',
    maxItems: 5,
    userAgent: UA_BROWSER,
  },

  // ============================================================
  // 中文 — 情报（反诈 / 新型 / 警示）
  // ============================================================
  {
    key: 'gnews_zh_cn_anti_fraud',
    name: 'Google News (CN) - 反诈情报',
    category: 'intel',
    kind: 'rss',
    url: gnews({
      q: '反诈 OR 新型诈骗 OR 诈骗手段 OR 警惕',
      lang: 'zh',
      region: 'CN',
      whenDays: 10,
    }),
    language: 'zh',
    maxItems: 5,
    userAgent: UA_BROWSER,
  },
  {
    key: 'gnews_zh_hk_anti_fraud',
    name: 'Google News (HK) - 反诈情报',
    category: 'intel',
    kind: 'rss',
    url: gnews({
      q: '"骗案" OR "诈骗" OR "反诈" warning',
      lang: 'zh',
      region: 'HK',
      whenDays: 10,
    }),
    language: 'zh',
    maxItems: 5,
    userAgent: UA_BROWSER,
  },

  // ============================================================
  // 中文 — 案例（诈骗案 / 被骗 / 警方破案）
  // ============================================================
  {
    key: 'gnews_zh_cn_scam_cases',
    name: 'Google News (CN) - 诈骗案例',
    category: 'knowledge',
    kind: 'rss',
    url: gnews({
      q: '诈骗案 OR 被骗 OR 受害 OR 落网',
      lang: 'zh',
      region: 'CN',
      whenDays: 10,
    }),
    language: 'zh',
    maxItems: 5,
    userAgent: UA_BROWSER,
  },
  {
    key: 'gnews_zh_hk_scam_cases',
    name: 'Google News (HK) - 诈骗案例',
    category: 'knowledge',
    kind: 'rss',
    url: gnews({
      q: '"骗徒" OR "受害" OR "诈骗" "案"',
      lang: 'zh',
      region: 'HK',
      whenDays: 10,
    }),
    language: 'zh',
    maxItems: 5,
    userAgent: UA_BROWSER,
  },
];

export function sourcesByCategory(cat: SourceCategory): SourceConfig[] {
  return SOURCES.filter((s) => s.category === cat);
}
