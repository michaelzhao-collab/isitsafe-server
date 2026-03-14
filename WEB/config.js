/**
 * 对外落地页配置
 */
window.APP_CONFIG = {
  /** 应用名称 */
  appName: '星识安全助手',
  /** 副标题 / Slogan */
  appSubtitle: '官方AI风险识别，守护你的安全',
  /** App Store 下载地址，留空则点击提示「市场正在审核中」 */
  appStoreUrl: '',
  /** Google Play 下载地址，留空则点击提示「市场正在审核中」 */
  googlePlayUrl: '',
  /** 联系邮箱（显示在页脚） */
  contactEmail: 'support@example.com',
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
    { image: 'assets/logo.png', title: '智能识别', desc: '链接、短信、截图一键分析风险' },
    { image: 'assets/logo.png', title: '风险库加持', desc: '结合风险数据库，结果更可靠' },
    { image: 'assets/logo.png', title: '防诈先行', desc: '守护每一次决策，远离诈骗' },
    { image: 'assets/logo.png', title: '安全守护', desc: 'AI 与风险库双重保障，识别更准' },
  ],
};
