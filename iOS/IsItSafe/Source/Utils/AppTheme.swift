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
    /// 主色 #2F6BFF
    public static let primary = Color(hex: "2F6BFF")
    /// 主背景（浅色 #F6F8FC，深色 系统背景）
    public static var background: Color { Color(UIColor.systemGroupedBackground) }
    /// 卡片背景（浅色 #FFFFFF，深色 次级系统背景）
    public static var cardBackground: Color { Color(UIColor.secondarySystemGroupedBackground) }
    /// 边框/分割线
    public static var border: Color { Color(UIColor.separator) }

    // MARK: - 文字（随系统自适应）
    /// 主文字
    public static var textPrimary: Color { Color(UIColor.label) }
    /// 次要文字
    public static var textSecondary: Color { Color(UIColor.secondaryLabel) }

    // MARK: - 风险等级
    /// 低风险 #2ECC71
    public static let riskLow = Color(hex: "2ECC71")
    /// 中风险 #F5A623
    public static let riskMedium = Color(hex: "F5A623")
    /// 高风险 #FF4D4F
    public static let riskHigh = Color(hex: "FF4D4F")
    /// 未知 #8A94A6
    public static let riskUnknown = Color(hex: "8A94A6")

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
    /// 底导背景
    public static var tabBarBackground: Color { cardBackground }

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
