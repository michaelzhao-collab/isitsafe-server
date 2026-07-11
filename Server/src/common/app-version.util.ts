/**
 * V5.1 客户端能力判定：新版 iOS 在每个请求带 X-App-Version（老版不带）。
 * 服务端据此对"共享接口触发的新行为"（家庭 IM 自动播报、免费 5 人）做版本门控：
 * 新版触发才启用，老版触发走老逻辑 —— 保证服务端部署对老用户零行为变化。
 *
 * IM_MIN_VERSION（env）可设最低启用版本；不设时"带了 X-App-Version 即视为新版"。
 * 另有 CHAT_ENABLED=false 作为紧急全局熔断（凌驾于版本门控之上）。
 */

function parse(v: string): number[] {
  return v
    .trim()
    .split('.')
    .map((x) => parseInt(x, 10))
    .map((n) => (Number.isFinite(n) ? n : 0));
}

/** a >= b（语义化版本比较，缺位补 0） */
export function versionGte(a: string, b: string): boolean {
  const pa = parse(a);
  const pb = parse(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return true; // 相等
}

/**
 * 该请求是否来自"支持家庭 IM"的新版客户端。
 * @param versionHeader 请求头 X-App-Version（老版为 undefined）
 */
export function isImCapableRequest(versionHeader: unknown): boolean {
  // 紧急熔断：无论版本一律关闭
  if (process.env.CHAT_ENABLED === 'false') return false;
  if (typeof versionHeader !== 'string' || !versionHeader.trim()) return false;
  const min = process.env.IM_MIN_VERSION;
  if (!min) return true; // 未设最低版本 → 带了版本头即视为新版
  return versionGte(versionHeader, min);
}
