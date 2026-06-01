# StarLensAI 市场图 PNG 输出物

> 渲染源：`docs/市场图设计-V2-Mockup.html`
> 工具：Puppeteer headless Chrome
> 一键导出脚本：`docs/market-export/export.js`

---

## 📁 目录结构

```
market-export/
├── 6.5inch-1242x2688/        # iPhone XS Max / 11 Pro Max @ 6.5"
│   ├── zh-1.png ~ zh-6.png   # 中文版 6 张
│   └── en-1.png ~ en-6.png   # 英文版 6 张
├── 12.9ipad-2064x2752/       # iPad Pro 12.9"
│   ├── zh-1.png ~ zh-6.png
│   └── en-1.png ~ en-6.png
├── export.js                 # Puppeteer 渲染脚本
├── package.json
└── README.md
```

## 📐 Apple 官方规格

| 设备 | 屏幕 | 分辨率 | 必填 |
|---|---|---|---|
| iPhone 6.5" | iPhone XS Max / 11 Pro Max | **1242×2688** | ✅ |
| iPad 12.9" | iPad Pro 12.9" | **2064×2752** | ✅ |

App Store Connect 上传截图时按 Display Size 分组，这两个尺寸是 Apple 当前规格里必须提供的。

---

## 🖼️ 每张图对应

| # | 主题 | 中文 | 英文 |
|---|---|---|---|
| 1 | 钩子：粘贴 → AI 秒判 | "别猜，扫一下" | "Scan it. Don't guess" |
| 2 | 风险详细报告 | "3 秒判定 清晰建议" | "3 seconds. Clear verdict." |
| 3 | 截图识别钓鱼内容 | "截图就能识破" | "Just send the screenshot" |
| 4 | 家庭守护 + 远程预警 | "守护爸妈 从远方" | "Protect parents from anywhere" |
| 5 | AI 语音深伪检测 | "是亲人 还是 AI？" | "Loved one? Or AI?" |
| 6 | 反诈情报站 | "昨天的诈骗 今天的防御" | "Yesterday's scams. Today's defense." |

---

## 🚀 上传 App Store Connect

1. App Store Connect → 你的 App → 1.0 版本 → App 截图
2. 选 **6.5" Display**：上传 `6.5inch-1242x2688/` 里的 6 张（按语言）
3. 选 **12.9" Display**：上传 `12.9ipad-2064x2752/` 里的 6 张
4. 英文版默认本地化：上传 `en-*.png`
5. 简体中文本地化：上传 `zh-*.png`

每个本地化必须独立上传一套截图。

---

## 🔁 重新生成

mockup HTML 改了或新增 screen 后：

```bash
cd docs/market-export
node export.js
```

依赖：`npm install puppeteer` （首次跑会自动装 Chromium ~150MB）

---

## 📅 变更历史

- **2026-06-01 V1**：6 主题 × 2 语言 × 2 尺寸 = 24 张首版
- 设计源：定稿 #1-C 星·镜 logo + V2 文案 + AppTheme 色系
