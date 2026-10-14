/**
 * 2026-10-14：家庭成员的统一默认名（服务端系统消息 / 推送与 iOS FamilyMember.effectiveName 同一套规则）。
 * 原来没设昵称的用户（Apple / 邮箱登录）在系统消息里是「家人」、推送里没有发送人、
 * 头像首字母自己看是 M（Me）别人看是成员行 id 的末位 —— 三处各不相同。
 *
 * 顺序：群昵称 → 用户昵称 → 手机尾号 4 位 → 邮箱 @ 前缀（Apple 隐藏邮箱除外）→ 用户 + userId 后 4 位
 */
export type NameSource = {
  userId: string;
  displayName?: string | null;
  nickname?: string | null;
  wechatNickname?: string | null;
  phone?: string | null;
  email?: string | null;
};

/** 邮箱 @ 前缀（隐藏邮箱 / 空 → null），最多 12 个字符 */
export function emailHandle(email?: string | null): string | null {
  const e = (email || '').trim().toLowerCase();
  if (!e || !e.includes('@') || e.endsWith('@privaterelay.appleid.com')) return null;
  const local = e.split('@')[0];
  return local ? local.slice(0, 12) : null;
}

export function memberDefaultName(s: NameSource, lang: 'zh' | 'en' = 'zh'): string {
  const pick = (v?: string | null) => (v || '').trim();
  const phone = pick(s.phone).replace(/\D/g, '');
  return (
    pick(s.displayName) ||
    pick(s.nickname) ||
    pick(s.wechatNickname) ||
    (phone.length >= 4 ? phone.slice(-4) : '') ||
    emailHandle(s.email) ||
    (lang === 'en' ? `User ${s.userId.slice(-4).toUpperCase()}` : `用户${s.userId.slice(-4).toUpperCase()}`)
  );
}
