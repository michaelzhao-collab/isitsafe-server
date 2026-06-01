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
                            .foregroundColor(AppTheme.textSecondary)
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
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
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
                Image(systemName: chip.iconType)
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(AppTheme.primary)
                    .frame(width: 24)
                Text(chip.label)
                    .font(.subheadline)
                    .foregroundColor(AppTheme.textPrimary)
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundColor(AppTheme.textSecondary)
            }
            .padding(.vertical, 12)
            .padding(.horizontal, 14)
            .background(AppTheme.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(AppTheme.border, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .contentShape(Rectangle())
    }
}
