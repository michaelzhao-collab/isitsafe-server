/**
 * 分页/数量参数的安全解析（2026-09-07 复核修复）。
 *
 * 问题：admin 与事件流接口直接用 `parseInt(query, 10)`，传 `?page=abc` 得到 NaN，
 * `Math.max(1, NaN)` 仍是 NaN，传给 Prisma 的 skip/take 会抛异常 → 500。
 * 后台随手改个 URL 就能让接口报错，日志里还看不出是入参问题。
 */
export function parsePositiveInt(
  raw: string | undefined,
  fallback: number,
  max?: number,
): number {
  const n = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return max != null ? Math.min(n, max) : n;
}
