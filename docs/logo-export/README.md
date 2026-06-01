# StarLensAI Logo 输出物

> 定稿版本：#1-C 星·镜 无柄居中（光学居中校正版）
> 设计源：`docs/logo设计-V1-Mockup.html` 中的 `#1-C` 方向

---

## 📁 目录结构

```
logo-export/
├── svg/                      # SVG 矢量源（可任意缩放/编辑）
│   ├── logo-full.svg         # 双圈（外淡 + 内粗）+ 中心星，64+ 像素用
│   └── logo-simple.svg       # 单圈粗 + 大星，< 64 像素用
├── ios/                      # iOS App Icon 全套
│   ├── AppIcon-1024.png      # App Store
│   ├── AppIcon-180.png       # iPhone @3x
│   ├── AppIcon-167.png       # iPad Pro
│   ├── AppIcon-152.png       # iPad
│   ├── AppIcon-120.png       # iPhone @2x
│   ├── AppIcon-87.png        # Settings @3x
│   ├── AppIcon-80.png        # Spotlight @2x
│   ├── AppIcon-76.png        # iPad 经典
│   ├── AppIcon-60.png        # iPhone Spotlight @3x
│   ├── AppIcon-58.png        # Settings @2x
│   ├── AppIcon-40.png        # Spotlight @1x
│   ├── AppIcon-29.png        # Settings @1x
│   └── AppIcon-20.png        # Notifications @1x
├── web/                      # 落地页 / favicon
│   ├── favicon-512.png       # PWA 大图标
│   ├── favicon-192.png       # PWA 标准
│   ├── favicon-180.png       # iOS Web Clip
│   ├── favicon-144.png       # Windows Tile
│   ├── favicon-96.png        # Android 桌面
│   ├── favicon-32.png        # 桌面浏览器 tab
│   └── favicon-16.png        # 浏览器 tab 小图
└── marketing/                # 市场物料（文档头图 / 截图素材）
    ├── logo-2048.png         # 超清，App Preview 视频用
    ├── logo-1024.png         # 同 AppIcon-1024
    ├── logo-512.png
    ├── logo-256.png
    └── logo-128.png
```

---

## 🎨 设计参数

| 项 | 值 |
|---|---|
| 主色（背景）| `linear-gradient(135deg, #1F4FCC → #2F6BFF → #5B86FF)` |
| 前景色 | `#FFFFFF` 纯白 |
| 圆环线宽（full）| 外圈 3pt opacity 0.45 / 内圈 6pt |
| 圆环线宽（simple）| 单圈 8pt |
| 星形几何 | 顶 y=25 / 底 y=70，已做光学居中（上移 3） |
| 圆角 | **无**（iOS / App Store 自动加圆角，不要在 PNG 里加边）|

---

## 🚀 已落地

### iOS App Icon（已替换）

- `iOS/IsItSafe/Source/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png` ← 新 logo
- 老的 ChatGPT 生成图（`ChatGPT Image 2026年3月19日 23_45_28.png`）已删
- `Contents.json` 的 filename 已更新

Xcode 下次 build 自动用新 logo。

---

## ⏳ 待手动落地

### 1. App Store Connect 重传

App Store Connect → 你的 App → App 信息 → App Icon → **上传 `marketing/logo-1024.png`**

### 2. WEB 落地页

把 `web/favicon-*.png` 都复制到 `WEB/assets/`，并更新 `WEB/index.html` 的 favicon link 标签：

```html
<link rel="apple-touch-icon" sizes="180x180" href="assets/favicon-180.png">
<link rel="icon" type="image/png" sizes="32x32" href="assets/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="assets/favicon-16.png">
<link rel="manifest" href="site.webmanifest">
```

### 3. 市场图 mockup

`docs/市场图设计-V2-Mockup.html` 里如果有用旧 logo 头图的位置，替换为 `marketing/logo-512.png` 或对应尺寸。

---

## 🔁 重新生成

源文件改了之后，重跑这条命令一次全出：

```bash
cd docs/logo-export

# iOS（80+ 用 full / 其余 simple）
for size in 1024 180 167 152 120 87 80; do
  rsvg-convert -w $size -h $size svg/logo-full.svg -o "ios/AppIcon-${size}.png"
done
for size in 76 60 58 40 29 20; do
  rsvg-convert -w $size -h $size svg/logo-simple.svg -o "ios/AppIcon-${size}.png"
done

# Web favicon
for size in 512 192 180 144 96 32 16; do
  if [ $size -ge 64 ]; then
    rsvg-convert -w $size -h $size svg/logo-full.svg -o "web/favicon-${size}.png"
  else
    rsvg-convert -w $size -h $size svg/logo-simple.svg -o "web/favicon-${size}.png"
  fi
done

# Marketing
for size in 2048 1024 512 256 128; do
  rsvg-convert -w $size -h $size svg/logo-full.svg -o "marketing/logo-${size}.png"
done
```

依赖：`brew install librsvg`

---

## 📅 变更历史

- **2026-06-01 V1 定稿**：#1-C 方向 + 五角星光学居中校正（path 上移 3 单位）
