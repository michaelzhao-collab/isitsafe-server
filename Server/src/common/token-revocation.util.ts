/**
 * Access token 吊销名单（2026-09-07 复核修复）
 *
 * 背景：logout() 原来只删 Redis 里的 refresh token，access token 仍有 7 天有效期
 * （JWT_EXPIRES_IN 默认 7d），手机被盗 / 用户主动退出后旧 token 照样能调所有接口。
 *
 * 做法：登出 / 注销账号时记录一个"此刻之前签发的 token 全部作废"的时间戳，
 * JwtStrategy 校验 payload.iat 是否早于它。JWT 仍然无状态签发，只多一次 Redis 读。
 *
 * 降级策略：Redis 不可用时 **放行**。宁可让极少数已登出 token 多活一会儿，
 * 也不能因为 Redis 抖动把全站用户挡在门外。
 */

/** Redis key 前缀：token_revoked_before:{userId} = 吊销基准的 unix 秒 */
export const REVOKED_BEFORE_PREFIX = 'token_revoked_before:';

/**
 * 吊销记录的保留时长：access token 最长有效期（7d）+ 1d 缓冲。
 * 超过这个时间的 token 本身已过期，不需要再记吊销。
 */
export const ACCESS_TOKEN_MAX_TTL_SEC = 8 * 24 * 3600;

export function revokedBeforeKey(userId: string): string {
  return REVOKED_BEFORE_PREFIX + userId;
}

/**
 * 判断某个 iat 是否落在吊销基准之前。
 *
 * 用严格小于：登出后立刻重新登录时，新 token 的 iat 可能与吊销时间戳同秒，
 * 这种情况必须放行，否则用户会陷入"登录成功但每个请求都 401"。
 */
export function isIssuedBeforeRevocation(iat: number | undefined, revokedBeforeRaw: string | null): boolean {
  if (!iat || !revokedBeforeRaw) return false;
  const revokedBefore = parseInt(revokedBeforeRaw, 10);
  if (!Number.isFinite(revokedBefore)) return false;
  return iat < revokedBefore;
}
