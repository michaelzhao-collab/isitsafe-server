//
//  OnboardingHero.swift
//  IsItSafe
//
//  V4-P1 冷启动引导首页内容：1 条欢迎气泡 + 4 个可点 chips
//  覆盖原先的 HomeEmptyStateContent 占位
//

import SwiftUI

public struct OnboardingHero: View {
    public let chips: [OnboardingChip]
    public let onChipTap: (OnboardingChip) -> Void
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"

    public init(chips: [OnboardingChip], onChipTap: @escaping (OnboardingChip) -> Void) {
        self.chips = chips
        self.onChipTap = onChipTap
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // 欢迎气泡（左对齐，模拟 bot 消息）
            HStack(alignment: .top, spacing: 0) {
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 6) {
                        Text("🛡️")
                        Text(languageCode == "en" ? "StarLens" : "星识安全助手")
                            .font(.caption.weight(.semibold))
                            .foregroundColor(AppTheme.primaryTint)
                    }
                    Text(welcomeText)
                        .font(.subheadline)
                        .foregroundColor(AppTheme.textPrimary)
                        .multilineTextAlignment(.leading)
                        .lineLimit(nil)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(14)
                .background(AppTheme.cardBackground)
                .clipShape(UnevenRoundedRectangle(topLeadingRadius: 16, bottomLeadingRadius: 6, bottomTrailingRadius: 16, topTrailingRadius: 16, style: .continuous))
                .cardShadow(radius: 8, y: 3)
                Spacer(minLength: 36)
            }

            // Chips 列表
            if !chips.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    Text(languageCode == "en" ? "Try asking me:" : "试试问我：")
                        .font(.caption)
                        .foregroundColor(AppTheme.textSecondary)
                        .padding(.leading, 4)
                    VStack(spacing: 10) {
                        ForEach(chips) { chip in
                            chipButton(chip: chip)
                        }
                    }
                }
            }
        }
        .padding(.horizontal, 16)
    }

    /// 题材 → 辅助色：电话 / 身份冒充偏青，短信 / 快递偏橙，投资 / 招聘偏紫，其余主色
    static func accent(for icon: String) -> AppTheme.Accent {
        if icon.contains("phone") || icon.contains("person") || icon.contains("message") { return .teal }
        if icon.contains("envelope") || icon.contains("shippingbox") || icon.contains("cart") { return .orange }
        if icon.contains("chart") || icon.contains("briefcase") || icon.contains("bitcoin") || icon.contains("dollar") { return .violet }
        return .blue
    }

    private var welcomeText: String {
        languageCode == "en"
            ? "Hi! I help you spot scams. Send me any suspicious link, phone number, screenshot, or message."
            : "你好！我能帮你识别诈骗。你可以把可疑的链接、号码、截图、消息发给我。"
    }

    private func chipButton(chip: OnboardingChip) -> some View {
        Button {
            onChipTap(chip)
        } label: {
            HStack(spacing: 12) {
                // 2026-10-14 配色 V2：按题材配浅底辅助色图标
                let accent = Self.accent(for: chip.iconType)
                Image(systemName: chip.iconType)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(accent.foreground)
                    .frame(width: 30, height: 30)
                    .background(RoundedRectangle(cornerRadius: 9, style: .continuous).fill(accent.soft))
                Text(chip.label)
                    .font(.subheadline)
                    .foregroundColor(AppTheme.textPrimary)
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundColor(AppTheme.textSecondary.opacity(0.6))
            }
            .padding(.vertical, 10)
            .padding(.horizontal, 12)
            .background(AppTheme.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .cardShadow(radius: 8, y: 3)
        }
        .buttonStyle(.plain)
        .contentShape(Rectangle())
    }
}
