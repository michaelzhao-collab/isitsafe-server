# 启动图说明（小 Logo + APP 名称）

当前启动图使用 **UILaunchScreen**（Info.plist）：只支持**一张图 + 背景色**，系统会按比例缩放图片。  
若 Logo 显得过大，或需要在 Logo 下方显示「星识安全助手」，请用设计工具做一张**合成图**替换本 imageset 里的 `LaunchImage.png`。

## 建议规格

- **画布**：建议 1242×2688（iPhone 6.5" 逻辑尺寸 ×3），或 1284×2778（iPhone 14 Pro Max）。
- **背景**：与 APP 一致 `#F6F8FC`，或透明（由系统用 LaunchBackground 填充）。
- **Logo**：居中偏上，建议约 **160×160 pt**（即 480×480 px @3x），不要铺满整屏。
- **文案**：Logo 正下方加「**星识安全助手**」，字号约 28–34 pt，颜色 `#1F2D3D`。

导出为 **LaunchImage.png** 替换 `LaunchImage.imageset/LaunchImage.png`，并在 Contents.json 中保留 1x/2x/3x 配置（可先只提供一张 @3x 图，Xcode 会缩放）。
