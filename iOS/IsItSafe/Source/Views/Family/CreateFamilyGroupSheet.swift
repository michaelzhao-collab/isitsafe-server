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
        VStack(spacing: 6) {
            Text("👨‍👩‍👧‍👦").font(.system(size: 56))
            Text(languageCode == "en" ? "Guard the whole family" : "守护全家安全")
                .font(.title3.weight(.bold))
            Text(languageCode == "en"
                 ? "Free to create. Look after each other."
                 : "免费创建家庭组，全家互相关怀")
                .font(.subheadline)
                .foregroundColor(AppTheme.textSecondary)
        }
        .padding(.top, 8)
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
        VStack(alignment: .leading, spacing: 12) {
            Text(languageCode == "en" ? "Three Mechanisms" : "三大功能")
                .font(.subheadline.weight(.semibold))
                .foregroundColor(AppTheme.textSecondary)
            feature(
                icon: "👥",
                title: languageCode == "en" ? "Family network" : "关系网络",
                desc: languageCode == "en" ? "Up to 5 people · invite via WeChat/SMS" : "最多 5 人 · 微信/短信邀请"
            )
            feature(
                icon: "💚",
                title: languageCode == "en" ? "Care reminders" : "关怀机制",
                desc: languageCode == "en" ? "Push & SMS if a member is inactive 2+ days" : "家人连续 2 天未活跃自动提醒"
            )
            feature(
                icon: "📢",
                title: languageCode == "en" ? "Official broadcast" : "官方匿名广播",
                desc: languageCode == "en" ? "Scams from queries auto-broadcast officially" : "查到诈骗自动以官方名义通知"
            )
        }
        .padding(AppTheme.Spacing.lg)
        .background(AppTheme.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.medium))
    }

    private func feature(icon: String, title: String, desc: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Text(icon).font(.title3)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline.weight(.semibold))
                Text(desc).font(.caption).foregroundColor(AppTheme.textSecondary)
            }
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
