//
//  CreateFamilyGroupSheet.swift
//  IsItSafe
//
//  V3-E 创建家庭组（免费）— 对应 mockup E-P2
//

import SwiftUI

public struct CreateFamilyGroupSheet: View {
    @ObservedObject var vm: FamilyViewModel
    @Environment(\.dismiss) private var dismiss
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    @State private var name: String = ""
    @State private var submitting = false

    public init(vm: FamilyViewModel) {
        self.vm = vm
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: AppTheme.Spacing.lg) {
                    hero
                    freeBadge
                    nameField
                    featuresCard
                    submitButton
                }
                .padding(AppTheme.Spacing.lg)
            }
            .background(AppTheme.background)
            .navigationTitle(languageCode == "en" ? "Create Family" : "创建家庭组")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(languageCode == "en" ? "Cancel" : "取消") { dismiss() }
                }
            }
        }
    }

    private var hero: some View {
        VStack(spacing: 14) {
            // 蓝渐变圆 + 白色 shield SF Symbol（跟 FamilyEmptyView hero 同款）
            ZStack {
                Circle()
                    .fill(LinearGradient(
                        colors: [AppTheme.primary.opacity(0.18), AppTheme.primary.opacity(0.04)],
                        startPoint: .top, endPoint: .bottom
                    ))
                    .frame(width: 100, height: 100)
                Circle()
                    .fill(LinearGradient(
                        colors: [AppTheme.primary, AppTheme.premiumHeader],
                        startPoint: .topLeading, endPoint: .bottomTrailing
                    ))
                    .frame(width: 76, height: 76)
                    .shadow(color: AppTheme.primary.opacity(0.25), radius: 10, x: 0, y: 4)
                Image(systemName: "shield.lefthalf.filled")
                    .font(.system(size: 34, weight: .semibold))
                    .foregroundColor(.white)
            }
            .padding(.top, 8)
            Text(languageCode == "en" ? "Guard the whole family" : "守护全家安全")
                .font(.title3.weight(.bold))
                .foregroundColor(AppTheme.textPrimary)
            Text(languageCode == "en"
                 ? "Free to create. Look after each other."
                 : "免费创建家庭组，全家互相关怀")
                .font(.subheadline)
                .foregroundColor(AppTheme.textSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
    }

    private var freeBadge: some View {
        HStack(spacing: 10) {
            Text("🎁").font(.title3)
            VStack(alignment: .leading, spacing: 2) {
                Text(languageCode == "en" ? "100% Free" : "完全免费")
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(AppTheme.primary)
                Text(languageCode == "en"
                     ? "No fees, no credit card, no commitment"
                     : "无需付费，无需绑卡，可随时退出")
                    .font(.caption)
                    .foregroundColor(AppTheme.textSecondary)
            }
            Spacer()
        }
        .padding(14)
        .background(AppTheme.premiumWhyCard.opacity(0.5))
        .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.medium))
    }

    private var nameField: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(languageCode == "en" ? "Group Name" : "家庭组名称")
                .font(.subheadline.weight(.semibold))
                .foregroundColor(AppTheme.textSecondary)
            TextField(
                languageCode == "en" ? "e.g. The Smiths" : "如：张家小院",
                text: $name
            )
            .textFieldStyle(.plain)
            .padding(14)
            .background(AppTheme.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.medium))
            .submitLabel(.done)
        }
    }

    private var featuresCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                Image(systemName: "sparkles")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(AppTheme.primary)
                Text(languageCode == "en" ? "Three Mechanisms" : "创建后立刻可用")
                    .font(.headline)
                    .foregroundColor(AppTheme.textPrimary)
            }
            feature(
                sfIcon: "person.2.fill",
                iconColor: AppTheme.primary,
                title: languageCode == "en" ? "Family network" : "关系网络",
                desc: languageCode == "en"
                    ? "Up to 5 members · invite via WeChat or SMS link"
                    : "最多 5 位家人 · 微信或短信发邀请链接"
            )
            feature(
                sfIcon: "heart.fill",
                iconColor: AppTheme.riskHigh,
                title: languageCode == "en" ? "Care reminders" : "关怀提醒",
                desc: languageCode == "en"
                    ? "Auto push + SMS when a member hasn't opened the app for 2+ days"
                    : "家人连续 2 天没打开 App 时，自动推送 + 短信提醒"
            )
            feature(
                sfIcon: "megaphone.fill",
                iconColor: AppTheme.riskMedium,
                title: languageCode == "en" ? "Anonymous family alert" : "家庭匿名广播",
                desc: languageCode == "en"
                    ? "When one checks a scam, the rest get an instant heads-up (anonymous)"
                    : "家人查到诈骗时，全家立刻收到匿名提醒"
            )
        }
        .padding(AppTheme.Spacing.lg)
        .background(AppTheme.cardBackground)
        .overlay(
            RoundedRectangle(cornerRadius: AppTheme.CornerRadius.medium)
                .stroke(AppTheme.primary.opacity(0.1), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.medium))
    }

    private func feature(sfIcon: String, iconColor: Color, title: String, desc: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 9, style: .continuous)
                    .fill(iconColor.opacity(0.12))
                    .frame(width: 36, height: 36)
                Image(systemName: sfIcon)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundColor(iconColor)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(AppTheme.textPrimary)
                Text(desc)
                    .font(.caption)
                    .foregroundColor(AppTheme.textSecondary)
                    .lineLimit(nil)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
    }

    private var submitButton: some View {
        VStack(spacing: 6) {
            Button {
                submit()
            } label: {
                HStack {
                    if submitting { ProgressView().tint(.white) }
                    Text(languageCode == "en" ? "Create for Free" : "免费创建家庭组")
                        .font(.body.weight(.semibold))
                }
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(AppTheme.primary)
                .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.medium))
            }
            .disabled(submitting)
            Text(languageCode == "en"
                 ? "No payment · No credit card"
                 : "无需付费 · 无需信用卡")
                .font(.caption)
                .foregroundColor(AppTheme.textSecondary)
        }
        .padding(.top, 8)
    }

    private func submit() {
        submitting = true
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        Task {
            let ok = await vm.createGroup(name: trimmed.isEmpty ? nil : trimmed)
            submitting = false
            if ok { dismiss() }
        }
    }
}
