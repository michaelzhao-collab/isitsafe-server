//
//  ElderHelpView.swift
//  IsItSafe
//
//  V3-J 长辈"我被骗了"简化求助页（J-P5）
//  3 步引导：① 打孩子 → ② 报警 110 → ③ 拨反诈 96110
//  附加：取证警示文案（不要删聊天/截图/转账记录）
//

import SwiftUI

public struct ElderHelpView: View {
    @Environment(\.dismiss) private var dismiss
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"

    public init() {}

    public var body: some View {
        NavigationStack {
            ZStack {
                AppTheme.background.ignoresSafeArea()
                ScrollView {
                    VStack(spacing: 18) {
                        heroSection
                        callChildButton
                        call110Button
                        call96110Button
                        evidenceWarning
                    }
                    .padding(.horizontal, 18)
                    .padding(.bottom, 32)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button { dismiss() } label: {
                        HStack {
                            Image(systemName: "chevron.left").font(.system(size: 20, weight: .semibold))
                            Text(languageCode == "en" ? "Back" : "返回").font(.system(size: 18))
                        }.foregroundColor(AppTheme.primaryTint)
                    }
                }
                ToolbarItem(placement: .principal) {
                    Text(languageCode == "en" ? "Don't worry" : "不要慌")
                        .font(.system(size: 20, weight: .semibold))
                }
            }
        }
    }

    private var heroSection: some View {
        VStack(spacing: 10) {
            Text("🤝").font(.system(size: 64))
            Text(languageCode == "en" ? "Step by step" : "我们一步一步来")
                .font(.system(size: 24, weight: .bold))
            Text(languageCode == "en"
                 ? "Most important: tell your child first."
                 : "第一步最重要：先告诉孩子")
                .font(.system(size: 17))
                .foregroundColor(AppTheme.textSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(.top, 16)
    }

    private var callChildButton: some View {
        bigStepButton(
            badge: "1️⃣",
            text: languageCode == "en" ? "Call my child now" : "立刻打给孩子",
            bg: AppTheme.riskLow
        ) {
            dismiss()
            NotificationCenter.default.post(name: .elderRequestCallGuardian, object: nil)
        }
    }

    private var call110Button: some View {
        bigStepButton(
            badge: "2️⃣",
            text: languageCode == "en" ? "Call 110 (police)" : "拨打 110 报警",
            bg: AppTheme.riskHigh
        ) {
            callPhone("110")
        }
    }

    private var call96110Button: some View {
        bigStepButton(
            badge: "3️⃣",
            text: languageCode == "en" ? "Call 96110 (anti-scam)" : "拨打 96110 反诈热线",
            bg: AppTheme.primary
        ) {
            callPhone("96110")
        }
    }

    @ViewBuilder
    private func bigStepButton(badge: String, text: String, bg: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Text(badge).font(.system(size: 32))
                Text(text)
                    .font(.system(size: 22, weight: .bold))
                    .multilineTextAlignment(.leading)
                Spacer()
            }
            .foregroundColor(.white)
            .frame(maxWidth: .infinity, minHeight: 76)
            .padding(.horizontal, 20)
            .background(bg)
            .clipShape(RoundedRectangle(cornerRadius: 18))
            .shadow(color: bg.opacity(0.3), radius: 6, x: 0, y: 3)
        }
    }

    private var evidenceWarning: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(languageCode == "en" ? "⚠️ Important" : "⚠️ 重要提醒")
                .font(.system(size: 19, weight: .bold))
                .foregroundColor(AppTheme.dynamic(light: 0x8B6900, dark: 0xFBBF5A))
            Text(languageCode == "en"
                 ? "Do NOT delete chat messages, screenshots, or transfer records — police will need them."
                 : "不要删除任何聊天记录、短信、转账截图。警察办案需要看。")
                .font(.system(size: 17))
                .foregroundColor(AppTheme.textPrimary)
                .lineSpacing(4)
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppTheme.dynamic(light: 0xFFF8E1, dark: 0x2A2416))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(AppTheme.dynamic(light: 0xFFE082, dark: 0x6B5A2A), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .padding(.top, 8)
    }

    private func callPhone(_ number: String) {
        guard let url = URL(string: "tel://\(number)") else { return }
        #if canImport(UIKit)
        if UIApplication.shared.canOpenURL(url) {
            UIApplication.shared.open(url)
        }
        #endif
    }
}
