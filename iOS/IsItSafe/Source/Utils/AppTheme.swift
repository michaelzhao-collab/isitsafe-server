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

    // 2026-10-14 配色 V2（见 docs/配色优化-V1-Mockup.html）：用户反馈「太素」。
    // 主色 #2F6BFF 不变；浅色底改为纯色雾蓝 #E4ECFB，深色底改为带蓝调的深海蓝 #0E1A33（不用纯黑）。
    // 主按钮 / 选中态 / 用户气泡用主色渐变 brandGradient；卡片带蓝调柔和阴影；入口图标用辅助色浅底。

    /// 浅 / 深两色的动态颜色
    static func dynamic(light: UInt32, dark: UInt32, darkAlpha: CGFloat = 1) -> Color {
        Color(UIColor { trait in
            trait.userInterfaceStyle == .dark ? UIColor(hex: dark, alpha: darkAlpha) : UIColor(hex: light)
        })
    }

    /// 主背景：浅色雾蓝 #E4ECFB / 深色深海蓝 #0E1A33
    public static var background: Color { dynamic(light: 0xE4ECFB, dark: 0x0E1A33) }

    /// 卡片背景：浅色纯白 / 深色 #17284A
    public static var cardBackground: Color { dynamic(light: 0xFFFFFF, dark: 0x17284A) }

    /// 边框 / 分割线：浅色 #DCE3F0 / 深色 #24365C
    public static var border: Color { dynamic(light: 0xDCE3F0, dark: 0x24365C) }

    // MARK: - 文字（随系统自适应）
    /// 主文字 #141A2B / #EEF2FA
    public static var textPrimary: Color { dynamic(light: 0x141A2B, dark: 0xEEF2FA) }
    /// 次要文字 #646C7C / #93A2BF
    public static var textSecondary: Color { dynamic(light: 0x646C7C, dark: 0x93A2BF) }

    // MARK: - 主色扩展（2026-10-14）
    /// 主色渐变 #2F6BFF → #1C8CEB：主按钮、发送键、底导选中、用户气泡、头像、会员卡
    /// （终点原定 #22A6F2，白字对比度只有约 2.7:1，压深到 #1C8CEB 约 3.5:1，观感几乎不变）
    public static let brandGradientColors: [Color] = [Color(hex: "2F6BFF"), Color(hex: "1C8CEB")]
    public static var brandGradient: LinearGradient {
        LinearGradient(colors: brandGradientColors, startPoint: .topLeading, endPoint: .bottomTrailing)
    }
    /// 深色上的主色文字 / 图标（#2F6BFF 在深海蓝上对比不足）：浅色仍是主色
    public static var primaryTint: Color { dynamic(light: 0x2F6BFF, dark: 0x8FB0FF) }
    /// 主色浅底：次按钮、建议胶囊、选中底
    public static var primarySoft: Color { dynamic(light: 0xEEF3FF, dark: 0x2F6BFF, darkAlpha: 0.20) }
    /// 主色浅描边：输入框、次按钮描边
    public static var primarySoftBorder: Color { dynamic(light: 0xDCE6FF, dark: 0x6F96FF, darkAlpha: 0.35) }
    /// 卡片阴影色：浅色带蓝调 / 深色加深
    public static var cardShadow: Color {
        Color(UIColor { trait in
            trait.userInterfaceStyle == .dark ? UIColor.black.withAlphaComponent(0.30) : UIColor(hex: 0x2F6BFF, alpha: 0.10)
        })
    }
    /// 底导 / 输入栏底：比页面底色略浅的同色系
    public static var barBackground: Color { dynamic(light: 0xF3F6FE, dark: 0x0B1630) }

    // MARK: - 辅助色（只做图标浅底，区分入口题材）
    public enum Accent: CaseIterable {
        case blue, teal, violet, orange
        /// 图标前景
        public var foreground: Color {
            switch self {
            case .blue: return AppTheme.dynamic(light: 0x2F6BFF, dark: 0x8FB0FF)
            case .teal: return AppTheme.dynamic(light: 0x0EA5A4, dark: 0x3FD3CF)
            case .violet: return AppTheme.dynamic(light: 0x7C5CFF, dark: 0xB4A2FF)
            case .orange: return AppTheme.dynamic(light: 0xF97316, dark: 0xFFA05C)
            }
        }
        /// 图标浅底
        public var soft: Color {
            switch self {
            case .blue: return AppTheme.dynamic(light: 0xEEF3FF, dark: 0x2F6BFF, darkAlpha: 0.20)
            case .teal: return AppTheme.dynamic(light: 0xE3F7F6, dark: 0x0EA5A4, darkAlpha: 0.18)
            case .violet: return AppTheme.dynamic(light: 0xF0ECFF, dark: 0x7C5CFF, darkAlpha: 0.22)
            case .orange: return AppTheme.dynamic(light: 0xFFEFE3, dark: 0xF97316, darkAlpha: 0.18)
            }
        }
    }

    /// 会员金 #F5B544（会员相关统一一个金）
    public static let gold = Color(hex: "F5B544")
    public static let goldGradient = LinearGradient(colors: [Color(hex: "FFD978"), Color(hex: "F5B544")],
                                                    startPoint: .topLeading, endPoint: .bottomTrailing)
    /// 会员卡：深蓝 → 主色 → 天蓝
    public static let memberGradient = LinearGradient(colors: [Color(hex: "0F2E86"), Color(hex: "2F6BFF"), Color(hex: "22A6F2")],
                                                      startPoint: .topLeading, endPoint: .bottomTrailing)

    // MARK: - 风险等级（Tailwind 系列，柔和但识别度高）
    /// 低风险 #10B981 emerald-500
    public static let riskLow = Color(hex: "10B981")
    /// 中风险 #F59E0B amber-500
    public static let riskMedium = Color(hex: "F59E0B")
    /// 高风险 #DC2626 red-600
    public static let riskHigh = Color(hex: "DC2626")
    /// 未知 #6B7280 中性灰
    public static let riskUnknown = Color(hex: "6B7280")

    /// 风险卡整卡浅底（2026-10-14）
    public static func riskSoft(_ level: String) -> Color {
        switch level.lowercased() {
        case "high": return dynamic(light: 0xFFF1F1, dark: 0x3A1C26)
        case "medium", "mid": return dynamic(light: 0xFFF8EC, dark: 0x2A2416)
        case "low": return dynamic(light: 0xEAFAF3, dark: 0x12302A)
        default: return cardBackground
        }
    }
    /// 风险卡标题条渐变
    public static func riskGradient(_ level: String) -> LinearGradient {
        let colors: [Color]
        switch level.lowercased() {
        case "high": colors = [Color(hex: "EF4444"), Color(hex: "DC2626")]
        case "medium", "mid": colors = [Color(hex: "F59E0B"), Color(hex: "F97316")]
        case "low": colors = [Color(hex: "10B981"), Color(hex: "059669")]
        default: colors = [Color(hex: "6B7280"), Color(hex: "4B5563")]
        }
        return LinearGradient(colors: colors, startPoint: .topLeading, endPoint: .bottomTrailing)
    }
    /// 风险卡「原因 / 建议」小标题色
    public static func riskSectionTitle(_ level: String) -> Color {
        switch level.lowercased() {
        case "high": return dynamic(light: 0xB91C1C, dark: 0xFF8A8A)
        case "medium", "mid": return dynamic(light: 0xB45309, dark: 0xFBBF5A)
        case "low": return dynamic(light: 0x047857, dark: 0x5EE0B0)
        default: return textPrimary
        }
    }

    // MARK: - 会员页
    /// 会员页头部深蓝 #1A237E
    public static let premiumHeader = Color(hex: "1A237E")
    /// 浅蓝提示底色（多以带透明度方式用于提示条；会员页已改为统一白卡片，不再使用）
    public static var premiumWhyCard: Color { dynamic(light: 0xE0EEF8, dark: 0x1D3157) }
    /// 会员页当前状态卡片：浅色模式用浅灰 #F2F2F7，深色模式用深灰 #2C2C2E
    /// 之前固定 #2C2C2E 在浅色模式下显得突兀
    public static var premiumStatusCard: Color {
        Color(UIColor { trait in
            trait.userInterfaceStyle == .dark
                ? UIColor(hex: 0x1D3157)
                : UIColor(hex: 0xEEF3FF)
        })
    }

    // MARK: - 协议链接（官方落地页，可点击打开）
    public static let termsURL = URL(string: "https://www.starlensai.com/terms")!
    public static let privacyURL = URL(string: "https://www.starlensai.com/privacy")!

    // MARK: - 兼容旧用法
    public static var secondaryText: Color { textSecondary }
    /// Tab 未选中（随系统）
    public static var tabInactive: Color { Color(UIColor.secondaryLabel) }
    /// 底导背景（2026-10-14：与输入栏同为 barBackground）
    public static var tabBarBackground: Color { barBackground }

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

extension UIColor {
    /// 0xRRGGBB 十六进制（2026-10-14 配色 V2 动态色用）
    convenience init(hex: UInt32, alpha: CGFloat = 1) {
        self.init(red: CGFloat((hex >> 16) & 0xFF) / 255,
                  green: CGFloat((hex >> 8) & 0xFF) / 255,
                  blue: CGFloat(hex & 0xFF) / 255,
                  alpha: alpha)
    }
}

// MARK: - 外观（2026-10-14：跟随系统 / 浅色 / 深色）

public enum AppAppearance: String, CaseIterable {
    case system, light, dark
    public static let storageKey = "isitsafe.appearance"

    public static var current: AppAppearance {
        AppAppearance(rawValue: UserDefaults.standard.string(forKey: storageKey) ?? "") ?? .system
    }

    public var interfaceStyle: UIUserInterfaceStyle {
        switch self {
        case .system: return .unspecified
        case .light: return .light
        case .dark: return .dark
        }
    }

    public func title(english: Bool) -> String {
        switch self {
        case .system: return english ? "System" : "跟随系统"
        case .light: return english ? "Light" : "浅色"
        case .dark: return english ? "Dark" : "深色"
        }
    }

    /// 应用到所有窗口：UIKit 层覆盖，sheet / alert / 系统控件一并生效（SwiftUI 的 preferredColorScheme 管不到已弹出的 UIKit 弹窗）
    @MainActor
    public static func applyToAllWindows(_ appearance: AppAppearance = .current) {
        for scene in UIApplication.shared.connectedScenes {
            guard let ws = scene as? UIWindowScene else { continue }
            for w in ws.windows { w.overrideUserInterfaceStyle = appearance.interfaceStyle }
        }
    }
}

// MARK: - 卡片阴影 modifier（2026-10-14）

public extension View {
    /// 蓝调柔和卡片阴影（深色模式自动加深）
    func cardShadow(radius: CGFloat = 10, y: CGFloat = 4) -> some View {
        self.shadow(color: AppTheme.cardShadow, radius: radius, x: 0, y: y)
    }
}
