/**
 * 取真实客户端 IP（2026-09-27 复核修复）。
 *
 * 背景：生产架构是 Cloudflare → Railway → Node/Express。Express 默认 `req.ip`
 * 是最近一跳代理的内网地址，对所有用户相同 —— 导致一切按 IP 的限流/配额变成
 * "全站共用一个桶"（限流形同虚设、邮箱验证码每小时全站只能发 20 个）。
 *
 * 取值优先级：
 *  1. `CF-Connecting-IP`：Cloudflare 在边缘写入的真实客户端 IP。客户端即使自己
 *     塞这个头，也会被 Cloudflare 覆盖，无法伪造。这是最可靠的来源。
 *  2. `X-Forwarded-For` 最左：仅当没走 Cloudflare（直连源站）时兜底。可被伪造，
 *     但结合下方的源站防护，攻击者要为每个请求换 IP 才能绕限流，成本已足够高。
 *  3. `req.ip` / socket 远端地址：最终兜底。
 *
 * 注意：不依赖 Express 的 `trust proxy` 跳数猜测（Cloudflare/Railway 的跳数不稳定，
 * 猜错就仍是全站一个桶）。这里直接读头，确定性更强。
 */
export function clientIp(req: any): string {
  if (!req) return 'unknown';

  const cf = headerValue(req.headers?.['cf-connecting-ip']);
  if (cf) return normalize(cf);

  const xff = headerValue(req.headers?.['x-forwarded-for']);
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return normalize(first);
  }

  const direct = req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress;
  return direct ? normalize(direct) : 'unknown';
}

function headerValue(v: unknown): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string') return v;
  return undefined;
}

/** 去掉 IPv4-mapped IPv6 前缀，让同一客户端的 v4/v6 表示归一 */
function normalize(ip: string): string {
  return ip.replace(/^::ffff:/, '').trim();
}
