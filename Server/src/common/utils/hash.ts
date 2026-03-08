/**
 * 缓存 key 用哈希（简单稳定，非加密）
 * 用于 cache:ai:{hash(input_type + normalized_content + language + country + provider)}
 */
import { createHash } from 'crypto';

export function hashForCache(parts: Record<string, string | undefined>): string {
  const str = Object.keys(parts)
    .sort()
    .map((k) => `${k}=${parts[k] ?? ''}`)
    .join('|');
  return createHash('sha256').update(str).digest('hex').slice(0, 32);
}
