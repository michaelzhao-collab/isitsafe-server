//
//  AppTheme.swift
//  IsItSafe
//
//  统一配色，与 docs/COLOR-PALETTE.md 一致。APP 与 Admin 共用此规范。
//

import SwiftUI

public enum AppTheme {
    // MARK: - 基础色
    /// 主色 #2F6BFF
    public static let primary = Color(hex: "2F6BFF")
    /// 主背景 #F6F8FC
    public static let background = Color(hex: "F6F8FC")
    /// 卡片 #FFFFFF
    public static let cardBackground = Color(hex: "FFFFFF")
    /// 边框 #E6EAF0
    public static let border = Color(hex: "E6EAF0")

    // MARK: - 文字
    /// 主文字 #1F2D3D
    public static let textPrimary = Color(hex: "1F2D3D")
    /// 次要文字 #5F6B7A
    public static let textSecondary = Color(hex: "5F6B7A")

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
    /// 为什么选择 Premium 浅蓝卡片背景 #E0EEF8
    public static let premiumWhyCard = Color(hex: "E0EEF8")
    /// 会员页当前状态卡片深灰 #2C2C2E
    public static let premiumStatusCard = Color(hex: "2C2C2E")

    // MARK: - 兼容旧用法
    public static let secondaryText = textSecondary
    /// Tab 未选中
    public static let tabInactive = Color(hex: "5F6B7A").opacity(0.8)
    /// 底导背景
    public static let tabBarBackground = cardBackground
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
