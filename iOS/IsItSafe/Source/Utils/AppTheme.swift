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
    /// 会员页当前状态卡片深灰 #2C2C2E
    public static let premiumStatusCard = Color(hex: "2C2C2E")

    // MARK: - 协议链接（官方落地页，可点击打开）
    public static let termsURL = URL(string: "https://www.starlensai.com/terms")!
    public static let privacyURL = URL(string: "https://www.starlensai.com/privacy")!

    // MARK: - 兼容旧用法
    public static var secondaryText: Color { textSecondary }
    /// Tab 未选中（随系统）
    public static var tabInactive: Color { Color(UIColor.secondaryLabel) }
    /// 底导背景
    public static var tabBarBackground: Color { cardBackground }
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
