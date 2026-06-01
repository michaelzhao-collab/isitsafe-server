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

/** 按目标尺寸构造单 screen 的 HTML */
function buildSingleScreenHtml({ style, svgDefs, screenHtml, targetW, targetH }) {
  // 原 mockup 的 .screen 宽 322 高 700，等比放大到 targetW × targetH
  // CSS 用绝对尺寸覆盖原变量
  const overrideCss = `
    body {
      background: #0A0E1F;
      margin: 0;
      padding: 0;
      width: ${targetW}px;
      height: ${targetH}px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    /* 覆盖 .screen 尺寸为目标 */
    .screen {
      width: ${targetW}px !important;
      height: ${targetH}px !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      padding-top: ${Math.round(targetH * 0.063)}px !important;
      padding-bottom: ${Math.round(targetH * 0.005)}px !important;
      padding-left: ${Math.round(targetW * 0.062)}px !important;
      padding-right: ${Math.round(targetW * 0.062)}px !important;
    }
    /* 顶部 hero 区域按比例放大 */
    .hero-top {
      height: ${Math.round(targetH * 0.157)}px !important;
      margin-bottom: ${Math.round(targetH * 0.026)}px !important;
    }
    .hero-headline {
      font-size: ${Math.round(targetH * 0.043)}px !important;
      line-height: 1.1 !important;
    }
    .hero-sub {
      font-size: ${Math.round(targetH * 0.019)}px !important;
    }
    /* iPhone Frame 按比例放大 */
    .phone-frame {
      width: ${Math.round(targetW * 0.776)}px !important;
      height: ${Math.round(targetH * 0.729)}px !important;
      border-radius: ${Math.round(targetW * 0.112)}px !important;
      padding: ${Math.round(targetW * 0.022)}px ${Math.round(targetW * 0.016)}px !important;
    }
    .phone-notch {
      top: ${Math.round(targetW * 0.025)}px !important;
      width: ${Math.round(targetW * 0.248)}px !important;
      height: ${Math.round(targetW * 0.056)}px !important;
      border-radius: ${Math.round(targetW * 0.037)}px !important;
    }
    .phone-screen {
      border-radius: ${Math.round(targetW * 0.087)}px !important;
      font-size: ${Math.round(targetH * 0.0128)}px !important;
    }
    .status-bar {
      height: ${Math.round(targetH * 0.0314)}px !important;
      padding: 0 ${Math.round(targetW * 0.05)}px 0 ${Math.round(targetW * 0.056)}px !important;
      font-size: ${Math.round(targetH * 0.0143)}px !important;
      border-top-left-radius: ${Math.round(targetW * 0.087)}px !important;
      border-top-right-radius: ${Math.round(targetW * 0.087)}px !important;
    }
    .status-right { gap: ${Math.round(targetW * 0.016)}px !important; }
    .sb-icon-signal { width: ${Math.round(targetH * 0.0186)}px !important; height: ${Math.round(targetH * 0.0129)}px !important; }
    .sb-icon-battery { width: ${Math.round(targetH * 0.0314)}px !important; height: ${Math.round(targetH * 0.0143)}px !important; }
    .sb-5g { font-size: ${Math.round(targetH * 0.0143)}px !important; }
    .nav-bar {
      height: ${Math.round(targetH * 0.0571)}px !important;
      padding: 0 ${Math.round(targetW * 0.037)}px !important;
      font-size: ${Math.round(targetH * 0.0157)}px !important;
    }
    .nav-icon { width: ${Math.round(targetH * 0.0314)}px !important; height: ${Math.round(targetH * 0.0314)}px !important; }
    .nav-icon svg { width: ${Math.round(targetH * 0.0257)}px !important; height: ${Math.round(targetH * 0.0257)}px !important; }
    .chat-area, .family-page, .voice-page, .intel-page { padding: ${Math.round(targetH * 0.0143)}px !important; }
    .bubble-user, .bubble-bot {
      padding: ${Math.round(targetH * 0.0114)}px ${Math.round(targetW * 0.031)}px !important;
      border-radius: ${Math.round(targetW * 0.044)}px !important;
      font-size: ${Math.round(targetH * 0.0129)}px !important;
      margin-bottom: ${Math.round(targetH * 0.0114)}px !important;
    }
    .input-bar { padding: ${Math.round(targetH * 0.0129)}px ${Math.round(targetW * 0.031)}px ${Math.round(targetH * 0.0143)}px !important; gap: ${Math.round(targetW * 0.025)}px !important; }
    .input-bar-icon { width: ${Math.round(targetH * 0.0371)}px !important; height: ${Math.round(targetH * 0.0371)}px !important; }
    .input-bar-icon svg { width: ${Math.round(targetH * 0.0371)}px !important; height: ${Math.round(targetH * 0.0371)}px !important; }
    .input-bar-field {
      border-radius: ${Math.round(targetH * 0.0229)}px !important;
      padding: ${Math.round(targetH * 0.01)}px ${Math.round(targetW * 0.031)}px !important;
      font-size: ${Math.round(targetH * 0.0129)}px !important;
      min-height: ${Math.round(targetH * 0.0429)}px !important;
      gap: ${Math.round(targetW * 0.019)}px !important;
    }
    .input-bar-mic { width: ${Math.round(targetH * 0.0257)}px !important; height: ${Math.round(targetH * 0.0257)}px !important; }
    .input-bar-mic svg { width: ${Math.round(targetH * 0.0257)}px !important; height: ${Math.round(targetH * 0.0257)}px !important; }
    .tab-bar {
      height: ${Math.round(targetH * 0.08)}px !important;
      padding: ${Math.round(targetH * 0.0086)}px 0 ${Math.round(targetH * 0.0171)}px !important;
      border-bottom-left-radius: ${Math.round(targetW * 0.087)}px !important;
      border-bottom-right-radius: ${Math.round(targetW * 0.087)}px !important;
    }
    .tab-item { font-size: ${Math.round(targetH * 0.0114)}px !important; gap: ${Math.round(targetH * 0.0043)}px !important; }
    .tab-icon-wrap { width: ${Math.round(targetH * 0.0457)}px !important; height: ${Math.round(targetH * 0.0457)}px !important; border-radius: ${Math.round(targetW * 0.031)}px !important; }
    .tab-icon-wrap svg { width: ${Math.round(targetH * 0.0257)}px !important; height: ${Math.round(targetH * 0.0257)}px !important; }
    /* 风险卡 */
    .risk-card-full { margin: ${Math.round(targetW * 0.025)}px !important; border-radius: ${Math.round(targetW * 0.044)}px !important; }
    .risk-header { padding: ${Math.round(targetH * 0.0114)}px ${Math.round(targetW * 0.037)}px !important; font-size: ${Math.round(targetH * 0.0143)}px !important; }
    .risk-body { padding: ${Math.round(targetH * 0.0143)}px ${Math.round(targetW * 0.037)}px !important; }
    .risk-summary { font-size: ${Math.round(targetH * 0.0129)}px !important; margin-bottom: ${Math.round(targetH * 0.0143)}px !important; }
    .risk-section-title { font-size: ${Math.round(targetH * 0.0129)}px !important; margin: ${Math.round(targetH * 0.0114)}px 0 ${Math.round(targetH * 0.0071)}px !important; }
    .risk-row { font-size: ${Math.round(targetH * 0.0114)}px !important; }
    /* Family */
    .family-card { padding: ${Math.round(targetH * 0.0143)}px !important; border-radius: ${Math.round(targetW * 0.044)}px !important; }
    .family-card-title { font-size: ${Math.round(targetH * 0.0143)}px !important; }
    .family-member { padding: ${Math.round(targetH * 0.01)}px 0 !important; font-size: ${Math.round(targetH * 0.0129)}px !important; }
    .family-avatar { width: ${Math.round(targetH * 0.04)}px !important; height: ${Math.round(targetH * 0.04)}px !important; font-size: ${Math.round(targetH * 0.0143)}px !important; }
    .family-name { font-size: ${Math.round(targetH * 0.0143)}px !important; }
    .family-status { font-size: ${Math.round(targetH * 0.01)}px !important; }
    .alert-badge, .safe-badge { font-size: ${Math.round(targetH * 0.01)}px !important; padding: ${Math.round(targetH * 0.0029)}px ${Math.round(targetW * 0.019)}px !important; }
    /* Voice gauge */
    .voice-gauge { width: ${Math.round(targetW * 0.373)}px !important; height: ${Math.round(targetW * 0.373)}px !important; }
    .voice-gauge-num { font-size: ${Math.round(targetH * 0.0371)}px !important; }
    .voice-gauge-label { font-size: ${Math.round(targetH * 0.01)}px !important; }
    .voice-verdict-title { font-size: ${Math.round(targetH * 0.0157)}px !important; }
    .voice-meta-line { font-size: ${Math.round(targetH * 0.0114)}px !important; }
    .voice-section { padding: ${Math.round(targetH * 0.0143)}px !important; border-radius: ${Math.round(targetW * 0.037)}px !important; }
    .voice-section-title { font-size: ${Math.round(targetH * 0.0129)}px !important; }
    .voice-feature-row { font-size: ${Math.round(targetH * 0.0114)}px !important; padding: ${Math.round(targetH * 0.0057)}px 0 !important; }
    .voice-advice-text { font-size: ${Math.round(targetH * 0.0114)}px !important; }
    /* Intel */
    .filter-chip { font-size: ${Math.round(targetH * 0.0114)}px !important; padding: ${Math.round(targetH * 0.0057)}px ${Math.round(targetW * 0.025)}px !important; border-radius: ${Math.round(targetW * 0.037)}px !important; }
    .intel-card { padding: ${Math.round(targetH * 0.0129)}px ${Math.round(targetW * 0.034)}px !important; border-radius: ${Math.round(targetW * 0.037)}px !important; margin-bottom: ${Math.round(targetH * 0.0086)}px !important; }
    .intel-title { font-size: ${Math.round(targetH * 0.0143)}px !important; margin-bottom: ${Math.round(targetH * 0.0057)}px !important; }
    .intel-tag { font-size: ${Math.round(targetH * 0.01)}px !important; padding: 1px ${Math.round(targetW * 0.016)}px !important; }
    .intel-meta { font-size: ${Math.round(targetH * 0.01)}px !important; }
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
