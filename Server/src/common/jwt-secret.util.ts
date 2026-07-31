/**
 * JWT 密钥统一入口（auth.module / jwt.strategy / chat.gateway 共用）。
 * 生产环境未设 JWT_SECRET 直接拒绝启动 —— 否则任何人都能用默认值 'secret'
 * 伪造令牌通过 REST 与 WS 鉴权；开发环境保留旧回退但打警告。
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }
  // eslint-disable-next-line no-console
  console.warn('[jwt] JWT_SECRET not set — falling back to insecure dev default');
  return 'secret';
}
