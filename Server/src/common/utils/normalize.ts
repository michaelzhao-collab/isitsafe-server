/**
 * Input Parser 用的内容标准化
 * 去空格、小写、去协议、去 www
 */
export function normalizeContent(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  let s = raw.trim().toLowerCase();
  // 去协议
  s = s.replace(/^https?:\/\//i, '');
  // 去 www.
  s = s.replace(/^www\./i, '');
  return s.trim();
}

/**
 * 检测输入类型：url | phone | company | text
 * - 包含 http/https -> url
 * - 近似电话号码规则 -> phone
 * - 命中公司/平台/投资关键词 -> company
 * - 否则 text
 */
export type InputType = 'text' | 'phone' | 'url' | 'company' | 'screenshot';

const COMPANY_KEYWORDS = [
  '公司', '平台', '投资', '理财', '基金', '证券', '贷款', '网贷',
  '交易所', 'app', '软件', '官网', '客服', '机构', '集团', '控股',
];

/**
 * 从用户输入中提取第一个 URL 或域名，供 URL 专用流程查询风险库。
 * 匹配 http(s)://... 或 域名形式（含 .com/.cn 等）。
 */
export function extractUrlFromContent(content: string): string {
  if (!content || typeof content !== 'string') return '';
  const s = content.trim();
  const withProtocol = s.match(/https?:\/\/[^\s\u4e00-\u9fa5]+/i);
  if (withProtocol) return withProtocol[0];
  const domainLike = s.match(/[a-z0-9][-a-z0-9]*(?:\.[a-z0-9][-a-z0-9]*)+(?:\/[^\s\u4e00-\u9fa5]*)?/i);
  if (domainLike) return domainLike[0];
  return s;
}

export function detectType(content: string, isScreenshot = false): InputType {
  if (isScreenshot) return 'screenshot';
  const normalized = normalizeContent(content);
  const original = content.trim();

  if (/^https?:\/\//i.test(original) || /^[a-z0-9-]+\.[a-z]{2,}(\/|$)/i.test(normalized)) {
    return 'url';
  }
  // 近似电话：纯数字+横线/空格，长度 7-15，或 1 开头 11 位
  if (/^[\d\s\-+]{7,15}$/.test(original.replace(/\s/g, '')) || /^1[3-9]\d{9}$/.test(original.replace(/\D/g, ''))) {
    return 'phone';
  }
  const lower = original.toLowerCase();
  if (COMPANY_KEYWORDS.some((k) => lower.includes(k))) {
    return 'company';
  }
  return 'text';
}
