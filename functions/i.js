/**
 * 家庭邀请落地页 /i?code=XXX&lang=en|zh 的服务端语言适配（2026-10-14）
 *
 * 页面里的文案由 invite.html 自带的 JS 按语言切换，但 iMessage / WhatsApp / 微信的链接预览卡片
 * 只读静态的 <title> 和 og:*，不执行 JS —— 原来不管邀请人用什么语言，预览卡片永远是中文。
 * 这里在边缘按 lang 参数（没有则看 Accept-Language）改写这几个标签，正文仍交给页面 JS。
 *
 * ⚠️ 只接管 /i 这一个路径（文件名即路由），/i/:code 旧链接仍走 _redirects。
 * ⚠️ WEB 和 admin 两个 Pages 项目根目录都是仓库根，会共用这个 functions/ —— admin 域名直接放行。
 */
const META = {
  zh: {
    title: '家人邀请你加入家庭守护 - 星识AI',
    desc: '你的家人邀请你加入星识AI家庭守护：遇到可疑链接、陌生来电、转账风险时，家人第一时间收到提醒。',
    ogTitle: '家人邀请你加入「家庭守护」',
    ogDesc: '下载星识AI，输入邀请码，和家人互相守护。',
    htmlLang: 'zh-CN',
  },
  en: {
    title: "You're invited to Family Guardian - StarLens AI",
    desc: 'Your family invited you to StarLens AI Family Guardian: when a suspicious link, unknown call or risky transfer shows up, your family gets alerted right away.',
    ogTitle: "You're invited to join Family Guardian",
    ogDesc: 'Download StarLens AI, enter the invite code, and look out for each other.',
    htmlLang: 'en',
  },
};

function pickLang(param, acceptLanguage) {
  if (param === 'en' || param === 'zh') return param;
  return /^\s*zh/i.test(acceptLanguage || '') ? 'zh' : 'en';
}

class SetAttr {
  constructor(attr, value) { this.attr = attr; this.value = value; }
  element(el) { el.setAttribute(this.attr, this.value); }
}
class SetText {
  constructor(value) { this.value = value; }
  element(el) { el.setInnerContent(this.value); }
}

export async function onRequestGet({ request, env, next }) {
  const url = new URL(request.url);
  if (url.hostname.startsWith('admin.') || url.hostname.includes('-admin.')) return next();

  // 取静态的 invite.html：请求 clean URL /invite（直接要 /invite.html 会被 Pages 308 到 /invite）
  const asset = await env.ASSETS.fetch(new URL('/invite', url.origin));
  if (!asset.ok) return next();

  const lang = pickLang(url.searchParams.get('lang'), request.headers.get('accept-language'));
  const m = META[lang];
  const res = new HTMLRewriter()
    .on('html', new SetAttr('lang', m.htmlLang))
    .on('title', new SetText(m.title))
    .on('meta[name="description"]', new SetAttr('content', m.desc))
    .on('meta[property="og:title"]', new SetAttr('content', m.ogTitle))
    .on('meta[property="og:description"]', new SetAttr('content', m.ogDesc))
    .transform(asset);

  const out = new Response(res.body, res);
  // 没带 lang 时内容随 Accept-Language 变，告诉缓存别混用
  out.headers.set('Vary', 'Accept-Language');
  return out;
}
