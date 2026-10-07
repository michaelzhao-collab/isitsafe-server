/**
 * 2026-10-07 复核修复（P0-8 / P1-12 / P2-20 / 残留「冒充熟人要钱」）：
 *
 *  - extractUrls / extractPhones：从任意位置抽出全部链接与号码（全角折半角、去尾部标点），
 *    供文本 / 截图 / company 路径逐个查风险库（原来只有「行首是 URL」才查，截图路径 100% 查不到）。
 *  - stripForeignContacts：模型输出里出现「原文没有、也不是地区热线」的号码 / 链接一律抹掉。
 *    提示词已禁止编造联系方式，这里是服务端硬兜底 —— 「搜客服电话」正是退款诈骗的主要入口。
 *  - filterActions：按钮白名单。call 只允许地区热线；open_url 只允许 https 且域名在白名单；其余类型放行。
 *  - sanitizeContext：客户端传来的 context 只有 @IsArray 校验，null / 非对象 / 任意 role / 无上限都会直接进提示词。
 *  - impersonatedRelativeAskingMoney：「妈，我手机掉水里了…先转 3000」lite 稳定只给 medium，用确定性规则兜底到 high。
 */
import { ALL_HOTLINE_DIGITS } from './hotlines';

export interface ContextMessage { role: string; content: string }

const FULLWIDTH_PUNCT: Record<string, string> = {
  '，': ',', '。': '.', '；': ';', '：': ':', '！': '!', '？': '?', '（': '(', '）': ')', '【': '[', '】': ']',
  '《': '<', '》': '>', '、': ',', '　': ' ', '／': '/', '．': '.', '－': '-', '＋': '+',
};

/** 全角字母数字 → 半角（NFKC），再把常见中文标点换成 ASCII，便于用一套正则 */
export function foldWidth(s: string): string {
  const nfkc = (s ?? '').normalize('NFKC');
  return nfkc.replace(/[，。；：！？（）【】《》、　／．－＋]/g, (ch) => FULLWIDTH_PUNCT[ch] ?? ch);
}

const TRAILING_PUNCT_RE = /[.,;:!?)\]}>'"、，。；：！？）】》]+$/;
const URL_WITH_SCHEME_RE = /https?:\/\/[^\s一-龥<>"',）】》，。；：！？]+/gi;
// 裸域名：至少两段、最后一段 2–24 个字母；前面不能紧贴字母数字 / @ / .（避免切出邮箱域名和域名尾巴）
const BARE_DOMAIN_RE = /(?<![\w@.\-/])((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24})(?::\d{2,5})?(\/[^\s一-龥<>"',）】》，。；：！？]*)?/gi;
/** 常见非域名的英文缩写 / 文件名，裸域名正则会误切 */
const BARE_DOMAIN_SKIP_RE = /^(e\.g|i\.e|etc|vs|node\.js|react\.js|vue\.js|next\.js|[a-z0-9-]+\.(js|ts|py|md|txt|png|jpg|jpeg|gif|pdf|doc|docx|xls|xlsx|zip|apk|ipa|exe|dmg))$/i;

export function hostOf(url: string): string {
  const raw = (url ?? '').trim();
  if (!raw) return '';
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
    return u.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** 抽出全部 URL / 裸域名（去重、去尾标点），最多 max 个 */
export function extractUrls(text: string, max = 5): string[] {
  const s = foldWidth(text);
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (m: string) => {
    const cleaned = m.replace(TRAILING_PUNCT_RE, '');
    const host = hostOf(cleaned);
    if (!host || !host.includes('.')) return;
    if (BARE_DOMAIN_SKIP_RE.test(host)) return;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(cleaned);
  };
  for (const m of s.match(URL_WITH_SCHEME_RE) ?? []) push(m);
  // 去掉带协议的部分再找裸域名，避免同一个链接出两次
  const rest = s.replace(URL_WITH_SCHEME_RE, ' ');
  for (const m of rest.match(BARE_DOMAIN_RE) ?? []) push(m);
  return out.slice(0, max);
}

// 号码：可带 +、空格、横线、括号；总位数 5–15（5–6 位是 95588 / 10086 这类服务号，16 位以上多为卡号 / 订单号，不当号码查）
const PHONE_CANDIDATE_RE = /(?<![\d.])\+?\d(?:[\d\s\-()]{3,20})\d(?!\d)/g;

/**
 * 「像电话号码」而不是金额 / 订单号 / 验证码 / 日期：
 * 11 位 1 开头手机号、0 开头 10–12 位固话、400/800 开头 10 位、+国家码 8–15 位，或整条文本本身就是一个 5–6 位服务号。
 * 复核 P0-1：原来「转账 50000 元」「订单号 20231007001」也被拿去查库，contains 命中任何含该子串的号码行就抬成 high。
 */
export function looksLikePhone(candidate: string, wholeText?: string): boolean {
  const raw = candidate.trim();
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 5 || digits.length > 15) return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  // 日期 / 时间写法
  if (/^\d{4}[-/.]\d{1,2}([-/.]\d{1,2})?$/.test(raw) || /\d{1,2}:\d{2}/.test(raw)) return false;
  if (/^\+\d{8,15}$/.test('+' + digits) && raw.startsWith('+')) return true;
  if (/^(?:86)?1[3-9]\d{9}$/.test(digits)) return true;
  if (/^0\d{9,11}$/.test(digits)) return true;
  if (/^[48]00\d{7}$/.test(digits)) return true;
  if (/^95\d{3,4}$|^1[0-2]\d{3}$/.test(digits) && (wholeText === undefined || wholeText.trim().replace(/[\s\-]/g, '') === digits)) return true;
  // 400-820-5555 / 0755-8888 6666 这类带分隔的写法已被上面覆盖；其余 7 位以下纯数字一律不算
  return false;
}

export function extractPhones(text: string, max = 5): string[] {
  const s = foldWidth(text);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of s.match(PHONE_CANDIDATE_RE) ?? []) {
    const digits = m.replace(/\D/g, '');
    if (digits.length < 5 || digits.length > 15) continue;
    if (!looksLikePhone(m, text)) continue;
    // 纯年份 / 金额样式（如 2026、3000.00）过滤：5 位以下已排除；带小数点的被 (?<![\d.]) 和 (?!\d) 挡掉一部分，再排除「全是同一数字」
    if (/^(\d)\1+$/.test(digits)) continue;
    const compact = m.trim().replace(/\s+/g, ' ');
    if (seen.has(digits)) continue;
    seen.add(digits);
    out.push(compact);
    if (out.length >= max) break;
  }
  return out;
}

// ─── 结果抹号 ───────────────────────────────────────────────────────────────

const OWN_HOST_ALLOW = ['starlensai.com', 'starlens.ai'];
/** 建议里可以出现的官方举报站点（与 hotlines.ts 文字对应） */
const OFFICIAL_HOST_ALLOW = ['reportfraud.ftc.gov', 'ftc.gov', 'actionfraud.police.uk', 'scamwatch.gov.au', 'scamshield.gov.sg', 'antifraud.ca', 'adcc.gov.hk', '165.npa.gov.tw', 'gov.cn', '12321.cn'];

function hostAllowed(host: string, inputHosts: Set<string>): boolean {
  if (!host) return true;
  if (inputHosts.has(host)) return true;
  for (const h of inputHosts) if (host.endsWith('.' + h) || h.endsWith('.' + host)) return true;
  for (const a of [...OWN_HOST_ALLOW, ...OFFICIAL_HOST_ALLOW]) if (host === a || host.endsWith('.' + a)) return true;
  return false;
}

export interface StripStats { phones: number; urls: number }

/** 常见官方服务号 / 公共热线：模型在建议里提到它们是正常的（「可拨 95588 核实」），不抹 */
const OFFICIAL_SERVICE_NUMBERS = new Set([
  '12306', '12315', '12321', '12377', '12345', '12123', '12333', '12366', '12378', '12368', '12309', '12348', '11183',
  '10086', '10010', '10000', '10001', '10050', '10099', '10198', '10100', '10110',
  '95588', '95533', '95555', '95566', '95559', '95528', '95599', '95561', '95568', '95501', '95508', '95516', '95511', '95519', '95500',
  '95595', '95577', '95558', '95580', '95526', '95586', '95338', '95311', '95320', '95543', '95546', '95549', '95554', '95177', '95188', '95017', '95118', '95105', '95520', '95013', '95118',
]);
/** 号码前 10 个字符内出现这些词 → 是单号 / 编号 / 验证码引用，不是联系方式 */
const NON_CONTACT_CONTEXT_RE = /(订单|单号|编号|运单|快递号|工单|案件|案号|验证码|取件码|卡号|账号|账户|尾号|金额|合计|共计|invoice|reference|ref\.?|order|case|tracking|code|id|no\.?|#)\s*[:：]?\s*$/i;

/** 只把全角字母 / 数字 / 点折成半角（不动「，。」等标点，避免改坏展示文案） */
function foldAlnum(s: string): string {
  return s.replace(/[Ａ-Ｚａ-ｚ０-９．]/g, (ch) => ch.normalize('NFKC'));
}

function stripInString(
  s: string,
  inputDigits: string,
  inputHosts: Set<string>,
  allowedDigits: Set<string>,
  language: 'zh' | 'en',
  stats: StripStats,
): string {
  if (!s) return s;
  // 复核：展示串里的全角域名（ｗｗｗ．ｅｖｉｌ．ｃｏｍ）要能被正则看到，只折字母数字和全角点，不折中文标点
  let out = foldAlnum(s);
  const phoneMask = language === 'zh' ? '[号码已隐去]' : '[number removed]';
  const urlMask = language === 'zh' ? '[链接已隐去]' : '[link removed]';
  // 链接：原文里有的、自家 / 官方举报站点放行，其余抹掉
  out = out.replace(URL_WITH_SCHEME_RE, (m) => {
    const host = hostOf(m.replace(TRAILING_PUNCT_RE, ''));
    if (hostAllowed(host, inputHosts)) return m;
    stats.urls++;
    return urlMask;
  });
  out = out.replace(BARE_DOMAIN_RE, (m) => {
    const host = hostOf(m.replace(TRAILING_PUNCT_RE, ''));
    if (!host || BARE_DOMAIN_SKIP_RE.test(host) || hostAllowed(host, inputHosts)) return m;
    stats.urls++;
    return urlMask;
  });
  // 号码：原文里出现过（按数字串包含）或在热线白名单的放行
  out = out.replace(PHONE_CANDIDATE_RE, (m: string, ...rest: any[]) => {
    const digits = m.replace(/\D/g, '');
    if (digits.length < 5 || digits.length > 15) return m;
    if (/^(\d)\1+$/.test(digits)) return m;
    if (allowedDigits.has(digits) || ALL_HOTLINE_DIGITS.includes(digits) || OFFICIAL_SERVICE_NUMBERS.has(digits)) return m;
    if (inputDigits.includes(digits)) return m;
    // 金额 / 日期 / 时间 / 单号不算号码：「10000 元」「2026-10-07」「¥50000」「12:30」「订单号 20231007001」
    const offset = rest[rest.length - 2] as number;
    const whole = rest[rest.length - 1] as string;
    const before = whole.slice(Math.max(0, offset - 1), offset);
    const after = whole.slice(offset + m.length, offset + m.length + 3);
    if (NON_CONTACT_CONTEXT_RE.test(whole.slice(Math.max(0, offset - 12), offset))) return m;
    // 不像电话（没有手机 / 固话 / 400 / 国际码形态）的纯数字串：订单号、流水号、金额，不抹
    if (!looksLikePhone(m)) return m;
    if (/[¥$￥€£]/.test(before)) return m;
    if (/^\s?(元|块|万|亿|美元|美金|港币|欧元|英镑|dollars?|bucks|usd|%|年|月|日|号|点|时|分|秒|:|：|人|次|条|个|件|km|m\b|kg)/i.test(after)) return m;
    if (/^\d{4}[-/.]\d{1,2}([-/.]\d{1,2})?$/.test(m.trim()) || /^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(m.trim())) return m;
    stats.phones++;
    return phoneMask;
  });
  return out;
}

/**
 * 把模型输出里「原文没有、也不是热线」的号码与链接抹掉。
 * 只处理面向用户展示的字符串字段；返回新对象与抹除统计。
 */
export function stripForeignContacts<T extends Record<string, any>>(
  result: T,
  inputText: string,
  language: 'zh' | 'en',
  regionAllowedDigits: string[] = [],
): { result: T; stats: StripStats } {
  const stats: StripStats = { phones: 0, urls: 0 };
  const inputFolded = foldWidth(inputText ?? '');
  const inputDigits = inputFolded.replace(/\D/g, '');
  const inputHosts = new Set(extractUrls(inputFolded, 50).map(hostOf).filter(Boolean));
  const allowed = new Set(regionAllowedDigits.map((d) => d.replace(/\D/g, '')));
  const fix = (v: unknown): unknown => {
    if (typeof v === 'string') return stripInString(v, inputDigits, inputHosts, allowed, language, stats);
    if (Array.isArray(v)) return v.map((x) => (typeof x === 'string' ? stripInString(x, inputDigits, inputHosts, allowed, language, stats) : x));
    return v;
  };
  const out: Record<string, any> = { ...result };
  for (const k of ['summary', 'reasons', 'advice', 'steps', 'free_text', 'freeText']) {
    if (k in out) out[k] = fix(out[k]);
  }
  return { result: out as T, stats };
}

// ─── 按钮白名单 ─────────────────────────────────────────────────────────────

export interface ActionLike { label?: string | null; type?: string | null; value?: string }

/**
 * call：号码必须是地区热线（或任一已知热线）；open_url：必须 https 且域名在原文 / 自家 / 官方白名单。
 * 其它类型（call_family / family_broadcast / knowledge / scam_check / dismiss）是客户端内部跳转，放行。
 */
export function filterActions(
  actions: ActionLike[] | undefined,
  inputText: string,
  regionAllowedDigits: string[] = [],
): ActionLike[] {
  if (!Array.isArray(actions)) return [];
  const inputHosts = new Set(extractUrls(foldWidth(inputText ?? ''), 50).map(hostOf).filter(Boolean));
  const allowed = new Set(regionAllowedDigits.map((d) => d.replace(/\D/g, '')));
  return actions.filter((a) => {
    if (!a || typeof a !== 'object') return false;
    const type = (a.type ?? '').toLowerCase();
    if (type === 'call') {
      const digits = String(a.value ?? '').replace(/\D/g, '');
      return digits.length > 0 && (allowed.has(digits) || ALL_HOTLINE_DIGITS.includes(digits));
    }
    if (type === 'open_url') {
      const v = String(a.value ?? '').trim();
      if (!/^https:\/\//i.test(v)) return false;
      return hostAllowed(hostOf(v), inputHosts);
    }
    return true;
  });
}

// ─── context 清洗 ───────────────────────────────────────────────────────────

export const CONTEXT_MAX_MESSAGES = 20;
export const CONTEXT_MAX_CHARS_EACH = 800;
export const CONTEXT_MAX_CHARS_TOTAL = 8000;

/**
 * 只保留 {role:'user'|'assistant', content:非空字符串}，取最近 20 条，单条 ≤800 字、总 ≤8000 字（丢最早的）。
 * 老客户端最多发 100 条 / 24000 字，这里是裁剪不是拒绝，不会让老版本 400。
 */
export function sanitizeContext(ctx: unknown): ContextMessage[] | undefined {
  if (!Array.isArray(ctx) || ctx.length === 0) return undefined;
  const valid: ContextMessage[] = [];
  for (const m of ctx) {
    if (!m || typeof m !== 'object') continue;
    const role = String((m as any).role ?? '').toLowerCase();
    const content = (m as any).content;
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') continue;
    const trimmed = content.trim();
    if (!trimmed) continue;
    valid.push({ role, content: trimmed.slice(0, CONTEXT_MAX_CHARS_EACH) });
  }
  if (valid.length === 0) return undefined;
  const recent = valid.slice(-CONTEXT_MAX_MESSAGES);
  let total = recent.reduce((n, m) => n + m.content.length, 0);
  while (recent.length > 0 && total > CONTEXT_MAX_CHARS_TOTAL) {
    total -= recent[0].content.length;
    recent.shift();
  }
  return recent.length > 0 ? recent : undefined;
}

// ─── 确定性兜底：冒充熟人 + 换号/出事 + 要钱 ───────────────────────────────────

// 称呼必须是「句首呼语」（妈，/ 爸：/ 奶奶 ）或「我是你儿子」——第三人称自述（「我妈妈住院了」「儿子出车祸」）不算
const SALUTATION_ZH = /(^|[\n。！!？?；;])\s*(老?妈妈?|老?爸爸?|奶奶|爷爷|外婆|外公|姥姥|姥爷|阿姨|舅舅?|叔叔?|姑姑?|老公|老婆|哥哥?|姐姐?|弟弟?|妹妹?|亲爱的)[，,、！!：:\s]|我是你(儿子|女儿|孙子|孙女|外孙|侄子|侄女|学生|领导|老板)/;
const PRETEXT_ZH = /(换号|新号|换了号|这是我新|手机(掉|丢|坏|进水|掉水|没电|被偷|被盗)|被抓|被拘|出事|住院|出车祸|在医院|在警局|急用钱|应急|救急|保释)/;
const MONEY_ZH = /((先|帮我|给我|快|马上|赶紧)?(转|打|汇|借|垫|给|充)[^\n]{0,8}?(钱|款|话费|学费|保释金|\d{3,}|[一二两三四五六七八九十百千万]+(块|元|万))|转账|汇款|打到(这|我|卡|账)|打这个卡|这张卡|这个账户|保释金)/;
// 本人在描述自己的需要 / 已做的事，不是在转述别人的要求
const SELF_NARRATIVE_ZH = /我(需要|想|得|打算|准备)(借|贷|转|打)|我(已经|刚)?(给|向)[^\n]{0,6}(转账|转了|打了|汇了)|有什么(正规|靠谱)/;

const SALUTATION_EN = /(^|[.!?\n])\s*(hi|hello|hey|dear)?[,\s]*(mom|mum|dad|grandma|grandpa|granny|nana|auntie|aunt|uncle|honey|sweetie)\b|\b(it'?s me|this is your (son|daughter|grandson|granddaughter|nephew|niece))\b/i;
const PRETEXT_EN = /\b(new number|lost my phone|phone (broke|died|got stolen|fell)|in jail|arrested|bail|in (the )?hospital|accident|emergency|stranded|stuck)\b/i;
const MONEY_EN = /\b(send|wire|transfer|lend|loan|venmo|zelle|paypal|gift cards?|bail money|top ?up|recharge|\$\s?\d{2,}|\d{3,}\s?(dollars|bucks|usd))\b/i;
const SELF_NARRATIVE_EN = /\bi (need|want|have) to (send|wire|transfer|pay|borrow)|\bis (wire transfer|it) safe\b|\binsurance company\b|\bmy (son|daughter|mom|dad|aunt|uncle|grandma|grandpa) (is|was|had)\b/i;

/**
 * 「妈，我手机掉水里了，这是我新号，先转 3000」类话术：句首称呼熟人 + 换号/出事借口 + 要钱 三者同时出现才命中。
 * 不命中：第一人称自述（「我妈妈住院了，我需要借 5000」「儿子出车祸，我已经转了 2 万」）、已核实（「确认过 / 是真的」）。
 */
export function impersonatedRelativeAskingMoney(content: string): boolean {
  const s = foldWidth(content ?? '');
  if (!s) return false;
  if (/(确认过|核实过|是真的|打电话问过|视频过|verified|confirmed it was|i checked)/i.test(s)) return false;
  const zh = SALUTATION_ZH.test(s) && PRETEXT_ZH.test(s) && MONEY_ZH.test(s) && !SELF_NARRATIVE_ZH.test(s);
  const en = SALUTATION_EN.test(s) && PRETEXT_EN.test(s) && MONEY_EN.test(s) && !SELF_NARRATIVE_EN.test(s);
  return zh || en;
}
