/**
 * App 语言工具（2026-10-14 国际化复核）
 *
 * iOS 每个请求都带 X-App-Language（'zh' | 'en'，取自 App 内语言设置）。
 * 产品规则：App 里设成英文，看到的一切都应是英文；反之亦然。
 * 原来各 controller 各自复制一份 resolveLanguageFromHeader，这里收拢成公共实现，新代码统一用这里的。
 */
export type AppLang = 'zh' | 'en';

/** 解析 X-App-Language；缺省时返回 fallback（默认 zh，与历史行为一致） */
export function resolveLanguageFromHeader(
  header?: string | string[] | null,
  fallback: AppLang = 'zh',
): AppLang {
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw) return fallback;
  const h = raw.trim().toLowerCase();
  if (h.startsWith('en')) return 'en';
  if (h.startsWith('zh')) return 'zh';
  return fallback;
}

/** 请求头里是否显式带了语言（没带的多为后台 / 老客户端，不做翻译、不同步用户语言） */
export function headerLanguage(header?: string | string[] | null): AppLang | null {
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw) return null;
  const h = raw.trim().toLowerCase();
  if (h.startsWith('en')) return 'en';
  if (h.startsWith('zh')) return 'zh';
  return null;
}

/** users.language 等存储值归一化 */
export function normalizeLang(lang?: string | null): AppLang {
  return (lang || '').toLowerCase().startsWith('en') ? 'en' : 'zh';
}
