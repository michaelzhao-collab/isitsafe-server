/**
 * V3-K AI 内容抓取源配置
 *
 * 每个源标记 `category`：
 *   - 'intel'      → 反诈情报（趋势 / 新型手段 / 官方通告）
 *   - 'knowledge'  → 反诈案例（具体真实事件 / 报道）
 *
 * 解析方式：
 *   - 'rss'  → 用 rss-parser 直接拉 feed.xml
 *   - 'html' → 用 axios + cheerio 抓首页，按 selector 提取条目
 *
 * 选源原则：
 *   - 国内：公安部 + 中国警察网（反诈频道）+ 国家反诈中心相关公开页
 *   - 国外：FTC（联邦贸易委员会） / FBI IC3 / BBB / ScamWatch / Action Fraud
 *   - 避开微信公众号（无公开 API，且强反爬）
 */

export type SourceCategory = 'intel' | 'knowledge';
export type SourceKind = 'rss' | 'html';

export interface SourceConfig {
  /** 唯一 key，落库 + 日志识别 */
  key: string;
  /** 显示名 */
  name: string;
  category: SourceCategory;
  kind: SourceKind;
  url: string;
  /** 原文主要语言 */
  language: 'zh' | 'en';
  /** HTML 解析时用的 selector（rss 忽略） */
  html?: {
    /** 文章列表项 */
    itemSelector: string;
    /** 在 item 内提取 title */
    titleSelector: string;
    /** 在 item 内提取 link */
    linkSelector: string;
    /** 链接属性名（默认 href） */
    linkAttr?: string;
    /** 在 item 内提取 summary（可选） */
    summarySelector?: string;
    /** 在 item 内提取发布日期（可选） */
    dateSelector?: string;
    /** baseUrl，用于相对链接拼接 */
    baseUrl?: string;
  };
  /** 默认 user-agent；某些站点反爬较强需要伪装浏览器 */
  userAgent?: string;
  /** 超时 ms（默认 12s） */
  timeoutMs?: number;
  /** 单源最大抓取条数（默认 5） */
  maxItems?: number;
}

const UA_BROWSER =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

export const SOURCES: SourceConfig[] = [
  // ============================================================
  // 英文情报源 — 趋势/新型手段/警示
  // ============================================================
  {
    key: 'ftc_consumer_alerts',
    name: 'FTC Consumer Alerts',
    category: 'intel',
    kind: 'rss',
    url: 'https://consumer.ftc.gov/blog.xml',
    language: 'en',
    maxItems: 5,
    userAgent: UA_BROWSER,
  },
  {
    key: 'scamwatch_news',
    name: 'ScamWatch AU News',
    category: 'intel',
    kind: 'rss',
    url: 'https://www.scamwatch.gov.au/news.xml',
    language: 'en',
    maxItems: 5,
    userAgent: UA_BROWSER,
  },
  {
    key: 'actionfraud_news',
    name: 'Action Fraud UK',
    category: 'intel',
    kind: 'html',
    url: 'https://www.actionfraud.police.uk/alert',
    language: 'en',
    maxItems: 5,
    userAgent: UA_BROWSER,
    html: {
      itemSelector: 'article.news, .views-row, .article',
      titleSelector: 'h2 a, h3 a, .title a',
      linkSelector: 'h2 a, h3 a, .title a',
      summarySelector: '.summary, p.intro, p:first-of-type',
      baseUrl: 'https://www.actionfraud.police.uk',
    },
  },

  // ============================================================
  // 英文案例源 — 具体真实事件
  // ============================================================
  {
    key: 'ic3_press',
    name: 'FBI IC3 Press Releases',
    category: 'knowledge',
    kind: 'html',
    url: 'https://www.ic3.gov/Home/Press',
    language: 'en',
    maxItems: 5,
    userAgent: UA_BROWSER,
    html: {
      itemSelector: 'div.list-group-item, article, .pressItem',
      titleSelector: 'h3 a, h4 a, .title a, a',
      linkSelector: 'h3 a, h4 a, .title a, a',
      summarySelector: '.summary, p',
      baseUrl: 'https://www.ic3.gov',
    },
  },
  {
    key: 'bbb_scam_news',
    name: 'BBB Scam News',
    category: 'knowledge',
    kind: 'html',
    url: 'https://www.bbb.org/all/scam-alerts',
    language: 'en',
    maxItems: 5,
    userAgent: UA_BROWSER,
    html: {
      itemSelector: 'article, .scam-alert, .article-list-item',
      titleSelector: 'h2 a, h3 a, a.title',
      linkSelector: 'h2 a, h3 a, a.title',
      summarySelector: 'p.summary, p.dek, p:first-of-type',
      baseUrl: 'https://www.bbb.org',
    },
  },

  // ============================================================
  // 中文情报源 — 公安部 / 中国警察网 反诈频道
  // ============================================================
  {
    key: 'cpd_anti_fraud',
    name: '中国警察网 反诈频道',
    category: 'intel',
    kind: 'html',
    url: 'https://www.cpd.com.cn/n26237378/',
    language: 'zh',
    maxItems: 5,
    userAgent: UA_BROWSER,
    html: {
      itemSelector: 'ul li, .news-list li, .list li',
      titleSelector: 'a',
      linkSelector: 'a',
      summarySelector: '.intro, .summary',
      baseUrl: 'https://www.cpd.com.cn',
    },
  },

  // ============================================================
  // 中文案例源 — 中国警察网 案件频道
  // ============================================================
  {
    key: 'cpd_cases',
    name: '中国警察网 案件频道',
    category: 'knowledge',
    kind: 'html',
    url: 'https://www.cpd.com.cn/n5644842/',
    language: 'zh',
    maxItems: 5,
    userAgent: UA_BROWSER,
    html: {
      itemSelector: 'ul li, .news-list li, .list li',
      titleSelector: 'a',
      linkSelector: 'a',
      summarySelector: '.intro, .summary',
      baseUrl: 'https://www.cpd.com.cn',
    },
  },
];

export function sourcesByCategory(cat: SourceCategory): SourceConfig[] {
  return SOURCES.filter((s) => s.category === cat);
}
