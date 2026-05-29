/**
 * V3-S5-1 内容归一化
 *
 * 用于 family_broadcasts.content_hash 与未来的去重 / 缓存 key 计算。
 *
 *   phone: E.164 规范化（"+86 159-1234-5678" 与 "15912345678" 等价）
 *   url:   小写 host + 去 utm_ 前缀 / fbclid / gclid 等追踪参数 + 去 fragment + 去末尾斜杠
 *   text:  NFKC 归一化（全角→半角）+ 折叠连续空白 + lowercase
 *
 * libphonenumber-js 已在 Server/package.json 中，无需新增依赖。
 */

import { parsePhoneNumberFromString } from 'libphonenumber-js';

const TRACKING_PARAM_PATTERNS = [
  /^utm_/i,
  /^fbclid$/i,
  /^gclid$/i,
  /^msclkid$/i,
  /^mc_eid$/i,
  /^mc_cid$/i,
  /^_hsenc$/i,
  /^_hsmi$/i,
  /^yclid$/i,
  /^ref$/i,
  /^source$/i,
];

export function normalizePhone(input: string): string {
  const trimmed = (input || '').trim();
  if (!trimmed) return '';
  // 先尝试解析（默认按 CN，让 +xx 开头的全球生效）
  const guess = parsePhoneNumberFromString(trimmed, 'CN');
  if (guess && guess.isValid()) {
    return guess.format('E.164');
  }
  // 兜底：仅保留数字（手机号场景）
  return trimmed.replace(/\D/g, '');
}

export function normalizeUrl(input: string): string {
  const trimmed = (input || '').trim();
  if (!trimmed) return '';
  let candidate = trimmed;
  if (!/^[a-z][a-z0-9+\-.]*:\/\//i.test(candidate)) {
    candidate = 'https://' + candidate;
  }
  try {
    const u = new URL(candidate);
    u.hostname = u.hostname.toLowerCase();
    // 去 fragment
    u.hash = '';
    // 去追踪参数
    const toDelete: string[] = [];
    u.searchParams.forEach((_, key) => {
      if (TRACKING_PARAM_PATTERNS.some((re) => re.test(key))) {
        toDelete.push(key);
      }
    });
    for (const k of toDelete) u.searchParams.delete(k);
    // 末尾 / 去掉（保留根路径 /）
    let str = u.toString();
    if (str.endsWith('/') && u.pathname !== '/') {
      str = str.slice(0, -1);
    }
    return str;
  } catch {
    return trimmed;
  }
}

export function normalizeText(input: string): string {
  const trimmed = (input || '').trim();
  if (!trimmed) return '';
  // NFKC 把全角字母 / 数字 / 标点压成半角
  const compat = trimmed.normalize('NFKC');
  // 折叠所有连续空白（包括中文全角空格已被 NFKC 转换）
  const collapsed = compat.replace(/\s+/g, ' ');
  return collapsed.toLowerCase();
}

/**
 * 按内容类型分发到对应归一化器。
 *   voice 走 text（一般传 voice:{taskId} 这种稳定标识，等同 text 归一）
 */
export function normalizeByType(
  contentType: 'phone' | 'url' | 'sms' | 'voice',
  content: string,
): string {
  switch (contentType) {
    case 'phone':
      return normalizePhone(content);
    case 'url':
      return normalizeUrl(content);
    case 'sms':
    case 'voice':
    default:
      return normalizeText(content);
  }
}
