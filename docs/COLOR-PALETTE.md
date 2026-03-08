# IsItSafe 统一配色规范

APP 与 Admin 管理系统均使用本配色，保持视觉一致。

---

## 基础色

| 名称 | 色值 | 用途 |
|------|------|------|
| **Primary** | `#2F6BFF` | 主色：按钮、链接、选中态、强调 |
| **Background** | `#F6F8FC` | 主背景 |
| **Card** | `#FFFFFF` | 卡片、输入框、弹层背景 |
| **Border** | `#E6EAF0` | 边框、分割线 |

---

## 文字色

| 名称 | 色值 | 用途 |
|------|------|------|
| **Text Primary** | `#1F2D3D` | 主文字、标题 |
| **Text Secondary** | `#5F6B7A` | 次要说明、辅助文案 |

---

## 风险等级色（Risk Colors）

| 等级 | 色值 | 用途 |
|------|------|------|
| **Low Risk** | `#2ECC71` | 低风险 |
| **Medium Risk** | `#F5A623` | 中风险 |
| **High Risk** | `#FF4D4F` | 高风险 |
| **Unknown** | `#8A94A6` | 未知 |

---

## 使用说明

- **iOS**：见 `Source/Utils/AppTheme.swift`，已按上述色值定义。
- **Admin**：在管理后台的样式/主题中引用上述色值（CSS 变量或 SCSS 等）。
