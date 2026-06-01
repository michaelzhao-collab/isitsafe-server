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
   * 下方横向滑动区：1242:2688（iPhone 6.5" 真实截图比例）
   * 6 张图按 6 个功能卖点排序
   * 每项：image 图片地址，title 标题，desc 描述
   */
  carousel: [
    { image: 'assets/slide1.png', title: 'Instant Scam Check',
      desc: 'Paste a text, link, or photo — AI judges in 3 seconds' },
    { image: 'assets/slide2.png', title: 'Clear Verdict + Next Steps',
      desc: 'Not just "risky" — AI tells you exactly what to do' },
    { image: 'assets/slide3.png', title: 'Screenshot Analysis',
      desc: 'WhatsApp, Messenger, websites — any screenshot works' },
    { image: 'assets/slide4.png', title: 'Family Guardian',
      desc: 'Instant alerts when loved ones face risky content' },
    { image: 'assets/slide5.png', title: 'AI Voice Deepfake Detector',
      desc: 'Catch AI-cloned voice scams of family members' },
    { image: 'assets/slide6.png', title: 'Scam Intel Library',
      desc: 'Real cases updated daily — stay one step ahead' },
  ],
};
