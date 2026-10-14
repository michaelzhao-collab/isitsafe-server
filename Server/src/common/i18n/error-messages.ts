import { AppLang } from './language.util';

/**
 * 面向 App 用户的错误文案中英对照（2026-10-14 国际化复核）
 *
 * 服务层抛异常时拿不到请求头，历史上中英文混着写死；iOS 会把 message 原样展示给用户，
 * 导致「App 设成英文却弹中文报错」（如 429「请求过于频繁」、家庭「你不是该家庭成员」），反之亦然。
 * 由 I18nHttpExceptionFilter 在出口处按 X-App-Language 统一翻译：
 *   - 只翻这里登记过的文案，其余原样返回（后台 / 内部校验类报错不受影响）
 *   - 请求没带 X-App-Language（管理后台、脚本）时完全不处理
 *
 * 刻意不登记：家庭邀请码兑换类报错（Invalid invite code / Invite code expired /
 * already a member / Family group is full (x/y) / Parental consent），
 * 老版本 iOS 靠匹配这些英文原文映射成自己的提示，翻译后会失配。
 */
type Pair = { zh: string; en: string };

const PAIRS: Pair[] = [
  // —— 限流 ——
  { zh: '请求过于频繁，请稍后再试', en: 'Too many requests. Please try again later.' },
  { zh: 'AI 分析请求过于频繁，请稍后再试', en: 'Too many analysis requests. Please try again later.' },
  // 英文须保留 "daily"：iOS 按「今日 / daily」或 code 10006 识别为额度用完
  { zh: '今日免费次数已用完，开通会员可无限使用', en: 'Your free daily checks are used up. Subscribe for unlimited use.' },
  { zh: '该邮箱今日请求过多，请稍后再试', en: 'Too many requests for this email. Please try again later.' },

  // —— 登录 / 账号 ——
  { zh: '请提供 phone 或 email', en: 'Please provide a phone number or email.' },
  { zh: '密码长度不能少于 8 位', en: 'Password must be at least 8 characters.' },
  { zh: '手机号或密码错误；如为旧版账号请联系客服找回', en: 'Incorrect phone number or password. For legacy accounts, please contact support.' },
  { zh: '验证码错误或已过期', en: 'The verification code is incorrect or has expired.' },
  { zh: '验证码发送失败，请稍后重试', en: 'Failed to send the verification code. Please try again later.' },
  { zh: '该邮箱是 Apple 隐藏邮箱，请改用「通过 Apple 登录」', en: 'This is an Apple private relay email. Please use Sign in with Apple instead.' },
  { zh: '服务暂时不可用，请稍后重试', en: 'Service temporarily unavailable. Please try again later.' },
  { zh: '用户不存在或已失效', en: 'User not found or no longer valid.' },
  { zh: '登录状态已失效，请重新登录', en: 'Your session has expired. Please sign in again.' },
  { zh: '服务暂时异常，请稍后重试', en: 'Something went wrong. Please try again later.' },
  { zh: '账号已被禁用，请联系客服', en: 'This account has been disabled. Please contact support.' },
  { zh: '手机号格式不正确', en: 'Invalid phone number' },
  { zh: '苹果登录凭证无效', en: 'Invalid Apple identity token' },
  { zh: '失败次数过多，请稍后再试', en: 'Too many failed attempts. Try again later.' },
  { zh: '账号已被临时锁定，请稍后再试', en: 'Account temporarily locked.' },
  { zh: '请先登录', en: 'Please sign in first.' },
  { zh: '用户不存在', en: 'User not found' },

  // —— 资料 / 历史 ——
  { zh: '获取历史记录失败，请稍后重试', en: 'Failed to load history. Please try again later.' },
  { zh: '删除失败，请稍后重试', en: 'Delete failed. Please try again later.' },
  { zh: '生日格式无效，请使用 YYYY-MM-DD', en: 'Invalid birthday format. Please use YYYY-MM-DD.' },
  { zh: '更新资料失败', en: 'Failed to update profile.' },

  // —— 家庭 / 群聊 ——
  { zh: '你不是该家庭成员', en: 'You are not a member of this family group.' },
  { zh: '你不是该家庭成员', en: 'You are not a member of this group' },
  { zh: '你不是该家庭成员', en: 'Not a member of this family group' },
  { zh: '你不是该家庭成员', en: 'Not a member of this group' },
  { zh: '你不是该家庭成员', en: 'not a member of this group' },
  { zh: '家庭组不存在', en: 'Family group not found.' },
  { zh: '家庭组不存在', en: 'Group not found' },
  { zh: '消息不存在', en: 'Message not found' },
  { zh: '只能撤回自己的消息', en: 'You can only recall your own messages.' },
  { zh: '超过 2 分钟，无法撤回', en: 'Messages can only be recalled within 2 minutes.' },
  { zh: '不能静音自己', en: 'You cannot mute yourself.' },
  { zh: '目标家人不在该家庭', en: 'That family member is not in this group.' },
  { zh: '你不在该家庭', en: 'You are not in this family group.' },
  { zh: '你不在该家庭组中', en: 'You are not in this family group' },
  { zh: '你还没有加入家庭组', en: 'Not in any family group' },
  { zh: '群主不能退出家庭，请改为解散家庭', en: 'Owner cannot leave; dissolve the group instead' },
  { zh: '只有群主可以解散家庭', en: 'Only owner can dissolve' },
  { zh: '只有群主可以移除成员', en: 'Only owner can remove' },
  { zh: '群主不能移除自己，请改为解散家庭', en: 'Owner cannot remove themselves; dissolve the group instead' },
  { zh: '邀请码生成失败，请重试', en: 'Invite code generation failed, retry' },
  { zh: '只有群主或监护人可以为其他家人开关长辈模式', en: 'Only owner/guardian can toggle elder mode for others' },
  { zh: '对方不在你的家庭组中', en: 'Target user not in your family group' },
  { zh: '昵称过长（最多 64 个字符）', en: 'Display name too long (max 64 chars)' },
  { zh: '备注过长（最多 64 个字符）', en: 'Alias too long (max 64 chars)' },
  { zh: '只有群主可以修改成员昵称', en: 'Only the family owner can rename members' },
  { zh: '该成员不在此家庭中', en: 'Member not found in this group' },
  { zh: '未找到该家人', en: 'Target member not found' },
  { zh: '不能拉黑自己', en: 'Cannot block yourself' },

  // —— 案例 / 情报 / 举报 ——
  { zh: '案例不存在或已下架', en: 'Knowledge case not found' },
  { zh: '情报不存在或已下架', en: 'Intel not found' },
  { zh: '提醒不存在', en: 'Alert not found' },
  { zh: '举报原因无效', en: 'Invalid reason' },
  { zh: '今日举报次数已达上限', en: 'Daily report limit reached' },

  // —— 深伪检测 ——
  { zh: '检测任务不存在', en: 'Task not found' },
  { zh: '无权访问该检测任务', en: 'Not your task' },

  // —— 暗网监控 ——
  { zh: '邮箱格式不正确', en: 'Invalid email format' },
  { zh: '该邮箱已在监控中', en: 'Target already exists' },
  { zh: '该功能仅在中国大陆以外地区提供', en: 'This feature is only available outside mainland China' },

  // —— 上传 ——
  { zh: '文件不是可识别的图片', en: 'File content is not a recognizable image' },
  { zh: '文件不是可识别的音频', en: 'File content is not a recognizable audio' },
  { zh: '缺少文件', en: 'Missing file' },

  // —— 订阅 ——
  {
    zh: '不支持降级套餐，请等当前订阅到期后再切换到低级套餐，或直接升级到更高套餐。',
    en: 'Downgrading is not supported. Please wait until the current subscription ends before switching to a lower plan, or upgrade to a higher plan.',
  },
];

/** 带参数的文案：正则 + 两种语言的模板（$1… 为捕获组） */
type Pattern = { zh: RegExp; en: RegExp; toZh: string; toEn: string };

const PATTERNS: Pattern[] = [
  {
    zh: /^发送太频繁，请 (\d+) 秒后再试$/,
    en: /^Too many requests\. Please try again in (\d+) seconds\.$/,
    toZh: '发送太频繁，请 $1 秒后再试',
    toEn: 'Too many requests. Please try again in $1 seconds.',
  },
  {
    zh: /^免费用户可创建 1 个家庭组，升级 Pro 最多可创建 (\d+) 个。$/,
    en: /^Free users can create 1 family group\. Upgrade to Pro to create up to (\d+)\.$/,
    toZh: '免费用户可创建 1 个家庭组，升级 Pro 最多可创建 $1 个。',
    toEn: 'Free users can create 1 family group. Upgrade to Pro to create up to $1.',
  },
  {
    zh: /^你已拥有 (\d+) 个家庭组（Pro 最多 (\d+) 个）$/,
    en: /^You already own (\d+) family groups \(max (\d+) for Pro\)$/,
    toZh: '你已拥有 $1 个家庭组（Pro 最多 $2 个）',
    toEn: 'You already own $1 family groups (max $2 for Pro)',
  },
  {
    // 生成邀请码时的满员提示（带 Upgrade 尾巴）；兑换时的「Family group is full (x/y)」不翻，见文件头
    zh: /^家庭组已满（(\d+)\/(\d+)），升级 Pro 最多可容纳 (\d+) 人。$/,
    en: /^Family group is full \((\d+)\/(\d+)\)\. Upgrade to Pro for up to (\d+) members\.$/,
    toZh: '家庭组已满（$1/$2），升级 Pro 最多可容纳 $3 人。',
    toEn: 'Family group is full ($1/$2). Upgrade to Pro for up to $3 members.',
  },
  {
    zh: /^已达到当前套餐上限（(\d+) 个邮箱），升级可监控更多$/,
    en: /^Plan limit reached \((\d+)\)\. Upgrade for more\.$/,
    toZh: '已达到当前套餐上限（$1 个邮箱），升级可监控更多',
    toEn: 'Plan limit reached ($1). Upgrade for more.',
  },
  {
    zh: /^检测尚未完成，暂时无法广播（(\w+)）$/,
    en: /^Cannot broadcast: task status is (\w+)$/,
    toZh: '检测尚未完成，暂时无法广播（$1）',
    toEn: 'Cannot broadcast: task status is $1',
  },
  {
    zh: /^文件大小不能超过 (\d+(?:\.\d+)?)MB$/,
    en: /^File size must be <= (\d+(?:\.\d+)?)MB$/,
    toZh: '文件大小不能超过 $1MB',
    toEn: 'File size must be <= $1MB',
  },
];

const TO_EN = new Map<string, string>();
const TO_ZH = new Map<string, string>();
for (const p of PAIRS) {
  if (!TO_EN.has(p.zh)) TO_EN.set(p.zh, p.en);
  if (!TO_ZH.has(p.en)) TO_ZH.set(p.en, p.zh);
}

/** 把一条错误文案翻成目标语言；未登记的原样返回 */
export function localizeErrorMessage(message: string, lang: AppLang): string {
  if (!message) return message;
  const exact = lang === 'en' ? TO_EN.get(message) : TO_ZH.get(message);
  if (exact) return exact;
  for (const p of PATTERNS) {
    const from = lang === 'en' ? p.zh : p.en;
    if (from.test(message)) return message.replace(from, lang === 'en' ? p.toEn : p.toZh);
  }
  return message;
}
