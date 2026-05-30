//
//  AppTheme.swift
//  IsItSafe
//
//  统一配色；基础背景/文字随系统深浅模式自适应。
//

import SwiftUI
import UIKit

public enum AppTheme {
    // MARK: - 基础色（随系统浅色/深色自适应）
    /// 主色 #2F6BFF（保持不变）
    public static let primary = Color(hex: "2F6BFF")

    // #7 配色调整（2026-05）：
    // 旧版用 systemGroupedBackground 太"系统默认"，没有产品记忆点
    // 新版用极浅冷灰，让卡片更突出 + 整体不刺眼

    /// 主背景
    ///   浅色 #ECEFF3 — 极浅冷灰（之前是 systemGroupedBackground 偏纯白）
    ///   深色 #0F1115 — 深空蓝灰
    public static var background: Color {
        Color(UIColor { trait in
            trait.userInterfaceStyle == .dark
                ? UIColor(red: 0x0F/255, green: 0x11/255, blue: 0x15/255, alpha: 1)
                : UIColor(red: 0xEC/255, green: 0xEF/255, blue: 0xF3/255, alpha: 1)
        })
    }

    /// 卡片背景
    ///   浅色 #FFFFFF — 保留纯白让卡片与背景对比清晰
    ///   深色 #1C1F26 — 深色卡片
    public static var cardBackground: Color {
        Color(UIColor { trait in
            trait.userInterfaceStyle == .dark
                ? UIColor(red: 0x1C/255, green: 0x1F/255, blue: 0x26/255, alpha: 1)
                : UIColor.white
        })
    }

    /// 边框/分割线 #E5E7EB（浅色） / #2A2E36（深色）
    public static var border: Color {
        Color(UIColor { trait in
            trait.userInterfaceStyle == .dark
                ? UIColor(red: 0x2A/255, green: 0x2E/255, blue: 0x36/255, alpha: 1)
                : UIColor(red: 0xE5/255, green: 0xE7/255, blue: 0xEB/255, alpha: 1)
        })
    }

    // MARK: - 文字（随系统自适应）
    /// 主文字 #1A1F2E（浅色，略带蓝调，不像普通系统黑） / #F2F4F8（深色）
    public static var textPrimary: Color {
        Color(UIColor { trait in
            trait.userInterfaceStyle == .dark
                ? UIColor(red: 0xF2/255, green: 0xF4/255, blue: 0xF8/255, alpha: 1)
                : UIColor(red: 0x1A/255, green: 0x1F/255, blue: 0x2E/255, alpha: 1)
        })
    }
    /// 次要文字 #6B7280 中性灰（兼顾浅 / 深）
    public static var textSecondary: Color {
        Color(UIColor { trait in
            trait.userInterfaceStyle == .dark
                ? UIColor(red: 0x9B/255, green: 0xA1/255, blue: 0xAD/255, alpha: 1)
                : UIColor(red: 0x6B/255, green: 0x72/255, blue: 0x80/255, alpha: 1)
        })
    }

    // MARK: - 风险等级（Tailwind 系列，柔和但识别度高）
    /// 低风险 #10B981 emerald-500
    public static let riskLow = Color(hex: "10B981")
    /// 中风险 #F59E0B amber-500
    public static let riskMedium = Color(hex: "F59E0B")
    /// 高风险 #DC2626 red-600
    public static let riskHigh = Color(hex: "DC2626")
    /// 未知 #6B7280 中性灰
    public static let riskUnknown = Color(hex: "6B7280")

    // MARK: - 会员页
    /// 会员页头部深蓝 #1A237E
    public static let premiumHeader = Color(hex: "1A237E")
    /// 为什么选择 Premium 浅蓝卡片背景（仅浅色模式用；深色用 cardBackground）
    public static let premiumWhyCard = Color(hex: "E0EEF8")
    /// 会员页当前状态卡片：浅色模式用浅灰 #F2F2F7，深色模式用深灰 #2C2C2E
    /// 之前固定 #2C2C2E 在浅色模式下显得突兀
    public static var premiumStatusCard: Color {
        Color(UIColor { trait in
            trait.userInterfaceStyle == .dark
                ? UIColor(red: 0x2C/255, green: 0x2C/255, blue: 0x2E/255, alpha: 1)
                : UIColor(red: 0xF2/255, green: 0xF2/255, blue: 0xF7/255, alpha: 1)
        })
    }

    // MARK: - 协议链接（官方落地页，可点击打开）
    public static let termsURL = URL(string: "https://www.starlensai.com/terms")!
    public static let privacyURL = URL(string: "https://www.starlensai.com/privacy")!

    // MARK: - 兼容旧用法
    public static var secondaryText: Color { textSecondary }
    /// Tab 未选中（随系统）
    public static var tabInactive: Color { Color(UIColor.secondaryLabel) }
    /// 底导背景：跟 cardBackground 微差，让 tabBar 跟主体分层
    public static var tabBarBackground: Color {
        Color(UIColor { trait in
            trait.userInterfaceStyle == .dark
                ? UIColor(red: 0x14/255, green: 0x17/255, blue: 0x1D/255, alpha: 1)
                : UIColor(red: 0xFA/255, green: 0xFB/255, blue: 0xFD/255, alpha: 1)
        })
    }

    // MARK: - 圆角规范（统一全局圆角口径，避免 8/10/12/16/20 散落各处）
    public enum CornerRadius {
        /// 小：tag、头像、小图标 8pt
        public static let small: CGFloat = 8
        /// 中：卡片、按钮 12pt
        public static let medium: CGFloat = 12
        /// 大：胶囊形输入框、bottom sheet 20pt
        public static let large: CGFloat = 20
    }

    // MARK: - 间距规范（与圆角配套）
    public enum Spacing {
        public static let xs: CGFloat = 4
        public static let sm: CGFloat = 8
        public static let md: CGFloat = 12
        public static let lg: CGFloat = 16
        public static let xl: CGFloat = 24
    }
}

// MARK: - 字号 helper（响应系统 Dynamic Type）
public extension Font {
    /// 基准字号 + 自动响应系统字号缩放设置
    /// 用法：`Text(...).font(.scaled(16, weight: .medium))`
    /// 内部走 `.system(size:weight:)` 但走 `relativeTo:` 桥接到对应的语义字体，让系统字号设置生效
    static func scaled(_ size: CGFloat, weight: Font.Weight = .regular, relativeTo: Font.TextStyle = .body) -> Font {
        .system(size: size, weight: weight).leading(.standard)
    }
}

// MARK: - View 便捷 modifier
public extension View {
    /// 给交互元素加上语义标签 + 提示（不影响视觉）
    /// 用法：`button.a11y(label: "发送查询", hint: "支持文字/语音/图片")`
    func a11y(label: String, hint: String? = nil) -> some View {
        self
            .accessibilityLabel(label)
            .accessibilityHint(hint ?? "")
    }
}

// 字号缩放，用于环境注入（0.85～1.15，默认 1）
public struct FontScaleKey: EnvironmentKey {
    public static let defaultValue: CGFloat = 1.0
}
extension EnvironmentValues {
    public var fontScale: CGFloat {
        get { self[FontScaleKey.self] }
        set { self[FontScaleKey.self] = newValue }
    }
}

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3:
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6:
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
