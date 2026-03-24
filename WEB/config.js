/**
 * 对外落地页配置
 */
window.APP_CONFIG = {
  /** 应用名称 */
  appName: 'StarLens AI',
  /** 副标题 / Slogan */
  appSubtitle: 'Official AI Risk Detection, Protecting Your Safety',
  /** App Store 下载地址，留空则点击提示「市场正在审核中」 */
  appStoreUrl: '',
  /** Google Play 下载地址，留空则点击提示「市场正在审核中」 */
  googlePlayUrl: '',
  /** 联系邮箱（显示在页脚） */
  contactEmail: 'gjtoolservice@outlook.com',
  /** 隐私政策页面 */
  privacyUrl: 'privacy.html',
  /** 用户协议页面 */
  termsUrl: 'terms.html',

  /**
   * 可选：整页背景图 URL（无版权图片，如 Unsplash/Pexels 等）
   * 留空则仅使用 CSS 渐变+光效
   */
  bgImageUrl: '',

  /**
   * 下方横向滑动区：9:16 竖图 + 文案
   * 每项：image 图片地址，title 标题，desc 描述
   * 留空或不存在时使用页面内默认四张占位
   */
  carousel: [
    { image: 'assets/logo.png', title: 'Smart Detection', desc: 'Analyze links, messages, and screenshots instantly' },
    { image: 'assets/logo.png', title: 'Powered by Risk Database', desc: 'More reliable results with real-world data support' },
    { image: 'assets/logo.png', title: 'Scam Prevention First', desc: 'Protect every decision and stay ahead of fraud' },
    { image: 'assets/logo.png', title: 'Dual Protection', desc: 'AI + risk database for more accurate detection' },
  ],
};
