#!/usr/bin/env node
/**
 * StarLensAI 市场图导出：HTML mockup → PNG
 * - 输入：docs/市场图设计-V2-Mockup.html（12 个 .screen 元素）
 * - 输出：2 个 Apple 规格 × 12 张 = 24 张 PNG
 *   - 6.5"  (iPhone XS Max / 11 Pro Max): 1242×2688
 *   - 12.9" (iPad Pro):                    2064×2752
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const MOCKUP_PATH = path.resolve(__dirname, '../市场图设计-V2-Mockup.html');
const OUT_DIR = __dirname;

const SIZES = [
  { name: '6.5inch-1242x2688',  w: 1242, h: 2688 },
  { name: '12.9ipad-2064x2752', w: 2064, h: 2752 },
];

/** 从 mockup HTML 中提取所需片段 */
function parseMockup(html) {
  // style block
  const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
  if (!styleMatch) throw new Error('未找到 <style> 块');
  const style = styleMatch[1];

  // SVG defs（包含 ic-/nav-/sb-/ib- 全部 symbol）
  const svgDefsMatch = html.match(/<svg style="display:none"[\s\S]*?<\/svg>/);
  if (!svgDefsMatch) throw new Error('未找到 SVG defs');
  const svgDefs = svgDefsMatch[0];

  // 提取所有 .screen 元素：用 DOM 风格深度匹配（自匹配 <div class="screen ..."> 内的嵌套）
  // 简化：先用 RegExp 找开始位置，然后栈匹配找结尾
  const screens = [];
  let cursor = 0;
  const openRe = /<div class="screen">/g;
  let m;
  while ((m = openRe.exec(html)) !== null) {
    const start = m.index;
    let depth = 1;
    let i = m.index + m[0].length;
    while (depth > 0 && i < html.length) {
      const nextOpen = html.indexOf('<div', i);
      const nextClose = html.indexOf('</div>', i);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        i = nextOpen + 4;
      } else {
        depth--;
        i = nextClose + 6;
      }
    }
    screens.push(html.slice(start, i));
    openRe.lastIndex = i;
  }
  return { style, svgDefs, screens };
}

/** 按目标尺寸构造单 screen 的 HTML
 *  关键修复：scale 改为按"高度"统一缩放（targetH / 700）
 *  原代码用 targetW 算 phone-frame 宽度 → iPad 比例宽 → phone-frame 被拉宽 → 手机变形
 *  现在 phone-frame 等比例放大，多出来的宽度变成左右背景，App Store iPad 截图标准做法
 */
function buildSingleScreenHtml({ style, svgDefs, screenHtml, targetW, targetH }) {
  const S = targetH / 700;       // 统一缩放因子（基于原 mockup 的 700px 高）
  const px = (v) => Math.round(v * S);
  const overrideCss = `
    /* body 满铺背景渐变（避免左右多出来的空间是黑色）*/
    body {
      margin: 0;
      padding: 0;
      width: ${targetW}px;
      height: ${targetH}px;
      overflow: hidden;
      background:
        radial-gradient(ellipse at 30% 0%, rgba(80, 110, 255, 0.5) 0%, transparent 50%),
        radial-gradient(ellipse at 70% 100%, rgba(20, 30, 130, 0.6) 0%, transparent 50%),
        linear-gradient(160deg, #0E1455 0%, #1830A8 50%, #1D3FE0 100%);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    /* .screen 改为固定宽度（基于原 mockup 比例 322），多余的宽度变背景 */
    .screen {
      width: ${px(322)}px !important;
      height: ${targetH}px !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      background: transparent !important;   /* 让 body 渐变透过 */
      padding: ${px(44)}px ${px(20)}px 0 !important;
    }
    /* hero / phone 全部基于 S 统一缩放 */
    .hero-top { height: ${px(110)}px !important; margin-bottom: ${px(18)}px !important; }
    .hero-headline { font-size: ${px(30)}px !important; line-height: 1.1 !important; }
    .hero-sub { font-size: ${px(13)}px !important; }
    .phone-frame {
      width: ${px(250)}px !important;
      height: ${px(510)}px !important;
      border-radius: ${px(36)}px !important;
      padding: ${px(7)}px ${px(5)}px !important;
    }
    .phone-notch { top: ${px(8)}px !important; width: ${px(80)}px !important; height: ${px(18)}px !important; border-radius: ${px(12)}px !important; }
    .phone-screen { border-radius: ${px(28)}px !important; font-size: ${px(9)}px !important; }
    .status-bar {
      height: ${px(22)}px !important;
      padding: 0 ${px(16)}px 0 ${px(18)}px !important;
      font-size: ${px(10)}px !important;
      border-top-left-radius: ${px(28)}px !important;
      border-top-right-radius: ${px(28)}px !important;
    }
    .status-right { gap: ${px(5)}px !important; }
    .sb-icon-signal { width: ${px(13)}px !important; height: ${px(9)}px !important; }
    .sb-icon-battery { width: ${px(22)}px !important; height: ${px(10)}px !important; }
    .sb-5g { font-size: ${px(10)}px !important; }
    .nav-bar { height: ${px(40)}px !important; padding: 0 ${px(12)}px !important; font-size: ${px(11)}px !important; }
    .nav-icon { width: ${px(22)}px !important; height: ${px(22)}px !important; }
    .nav-icon svg { width: ${px(18)}px !important; height: ${px(18)}px !important; }
    .chat-area, .family-page, .voice-page, .intel-page { padding: ${px(10)}px !important; }
    .bubble-user, .bubble-bot {
      padding: ${px(8)}px ${px(10)}px !important;
      border-radius: ${px(14)}px !important;
      font-size: ${px(9)}px !important;
      margin-bottom: ${px(8)}px !important;
    }
    .input-bar { padding: ${px(9)}px ${px(10)}px ${px(10)}px !important; gap: ${px(8)}px !important; }
    .input-bar-icon, .input-bar-icon svg { width: ${px(26)}px !important; height: ${px(26)}px !important; }
    .input-bar-field {
      border-radius: ${px(16)}px !important;
      padding: ${px(7)}px ${px(10)}px ${px(7)}px ${px(12)}px !important;
      font-size: ${px(9)}px !important;
      min-height: ${px(30)}px !important;
      gap: ${px(6)}px !important;
    }
    .input-bar-mic, .input-bar-mic svg { width: ${px(18)}px !important; height: ${px(18)}px !important; }
    .tab-bar {
      height: ${px(56)}px !important;
      padding: ${px(6)}px 0 ${px(12)}px !important;
      border-bottom-left-radius: ${px(28)}px !important;
      border-bottom-right-radius: ${px(28)}px !important;
    }
    .tab-item { font-size: ${px(8)}px !important; gap: ${px(3)}px !important; }
    .tab-icon-wrap { width: ${px(32)}px !important; height: ${px(32)}px !important; border-radius: ${px(10)}px !important; }
    .tab-icon-wrap svg { width: ${px(18)}px !important; height: ${px(18)}px !important; }
    /* 风险卡 */
    .risk-card-full { margin: ${px(8)}px !important; border-radius: ${px(14)}px !important; }
    .risk-header { padding: ${px(8)}px ${px(12)}px !important; font-size: ${px(10)}px !important; }
    .risk-body { padding: ${px(10)}px ${px(12)}px !important; }
    .risk-summary { font-size: ${px(9)}px !important; margin-bottom: ${px(10)}px !important; }
    .risk-section-title { font-size: ${px(9)}px !important; margin: ${px(8)}px 0 ${px(5)}px !important; }
    .risk-row { font-size: ${px(8)}px !important; margin-bottom: ${px(4)}px !important; }
    /* Family */
    .family-card { padding: ${px(10)}px !important; border-radius: ${px(14)}px !important; margin-bottom: ${px(8)}px !important; }
    .family-card-title { font-size: ${px(10)}px !important; margin-bottom: ${px(8)}px !important; }
    .family-member { padding: ${px(7)}px 0 !important; font-size: ${px(9)}px !important; }
    .family-avatar { width: ${px(28)}px !important; height: ${px(28)}px !important; font-size: ${px(10)}px !important; margin-right: ${px(9)}px !important; }
    .family-name { font-size: ${px(10)}px !important; }
    .family-status { font-size: ${px(8)}px !important; }
    .alert-badge, .safe-badge { font-size: ${px(7)}px !important; padding: ${px(2)}px ${px(6)}px !important; border-radius: ${px(8)}px !important; }
    /* Voice gauge */
    .voice-gauge { width: ${px(120)}px !important; height: ${px(120)}px !important; }
    .voice-gauge-num { font-size: ${px(26)}px !important; }
    .voice-gauge-label { font-size: ${px(7)}px !important; }
    .voice-verdict-title { font-size: ${px(11)}px !important; }
    .voice-meta-line { font-size: ${px(8)}px !important; margin-bottom: ${px(10)}px !important; }
    .voice-section { padding: ${px(10)}px !important; border-radius: ${px(12)}px !important; margin-bottom: ${px(8)}px !important; }
    .voice-section-title { font-size: ${px(9)}px !important; margin-bottom: ${px(6)}px !important; }
    .voice-feature-row { font-size: ${px(8)}px !important; padding: ${px(4)}px 0 !important; }
    .voice-advice-text { font-size: ${px(8)}px !important; line-height: 1.5 !important; }
    /* Intel */
    .filter-chip { font-size: ${px(8)}px !important; padding: ${px(4)}px ${px(8)}px !important; border-radius: ${px(12)}px !important; }
    .intel-card { padding: ${px(9)}px ${px(11)}px !important; border-radius: ${px(12)}px !important; margin-bottom: ${px(6)}px !important; }
    .intel-title { font-size: ${px(10)}px !important; margin-bottom: ${px(4)}px !important; }
    .intel-tag { font-size: ${px(7)}px !important; padding: ${px(1)}px ${px(5)}px !important; }
    .intel-meta { font-size: ${px(7)}px !important; }
  `;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8">
<style>${style}\n${overrideCss}</style>
</head>
<body>
${svgDefs}
${screenHtml}
</body>
</html>`;
}

(async () => {
  console.log('=== StarLensAI 市场图 PNG 导出 ===');
  console.log(`Mockup: ${MOCKUP_PATH}`);
  console.log(`Output: ${OUT_DIR}/{6.5inch,12.9ipad}/`);

  const html = fs.readFileSync(MOCKUP_PATH, 'utf-8');
  const { style, svgDefs, screens } = parseMockup(html);
  console.log(`\n找到 ${screens.length} 个 .screen 元素（预期 12: 6 中文 + 6 英文）`);

  if (screens.length !== 12) {
    console.warn(`⚠️  期待 12 张但找到 ${screens.length}，请检查 mockup`);
  }

  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  for (const size of SIZES) {
    const subdir = path.join(OUT_DIR, size.name);
    fs.mkdirSync(subdir, { recursive: true });
    await page.setViewport({ width: size.w, height: size.h, deviceScaleFactor: 1 });

    for (let i = 0; i < screens.length; i++) {
      const lang = i < 6 ? 'zh' : 'en';
      const idx = (i % 6) + 1;
      const filename = `${lang}-${idx}.png`;
      const outPath = path.join(subdir, filename);

      const fullHtml = buildSingleScreenHtml({
        style, svgDefs,
        screenHtml: screens[i],
        targetW: size.w,
        targetH: size.h,
      });
      await page.setContent(fullHtml, { waitUntil: 'load', timeout: 60000 });
      // 给字体渲染一点时间
      await new Promise(r => setTimeout(r, 200));
      await page.screenshot({
        path: outPath,
        clip: { x: 0, y: 0, width: size.w, height: size.h },
      });
      console.log(`  ✓ ${size.name}/${filename}`);
    }
  }

  await browser.close();
  console.log('\n=== 完成 ===');
})();
