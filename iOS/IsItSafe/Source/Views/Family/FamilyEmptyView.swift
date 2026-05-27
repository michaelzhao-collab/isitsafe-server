//
//  FamilyEmptyView.swift
//  IsItSafe
//
//  V3-E 空状态：用户已登录但未加入任何家庭组
//  对应 mockup E-P10
//

import SwiftUI

public struct FamilyEmptyView: View {
    public let onCreate: () -> Void
    public let onRedeem: () -> Void
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"

    public init(onCreate: @escaping () -> Void, onRedeem: @escaping () -> Void) {
        self.onCreate = onCreate
        self.onRedeem = onRedeem
    }

    public var body: some View {
        ScrollView {
            VStack(spacing: AppTheme.Spacing.lg) {
                heroSection
                createCard
                joinCard
                whatIsCard
            }
            .padding(AppTheme.Spacing.lg)
        }
        .background(AppTheme.background)
    }

    private var heroSection: some View {
        VStack(spacing: 8) {
            Text("👨‍👩‍👧‍👦")
                .font(.system(size: 64))
                .padding(.top, 12)
            Text(languageCode == "en" ? "Family Guard" : "家庭守护")
                .font(.title.weight(.bold))
                .foregroundColor(AppTheme.textPrimary)
            Text(languageCode == "en"
                 ? "Free to create. Look after each other."
                 : "免费创建，全家互相守护")
                .font(.subheadline)
                .foregroundColor(AppTheme.textSecondary)
        }
    }

    private var createCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "plus.circle.fill")
                    .foregroundColor(AppTheme.primary)
                    .font(.system(size: 20))
                Text(languageCode == "en" ? "Create a family group" : "创建家庭组")
                    .font(.headline)
                Spacer()
                Text(languageCode == "en" ? "FREE" : "免费")
                    .font(.caption.weight(.bold))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(AppTheme.riskLow.opacity(0.15))
                    .foregroundColor(AppTheme.riskLow)
                    .clipShape(Capsule())
            }
            Text(languageCode == "en"
                 ? "Up to 5 members. No payment required."
                 : "最多 5 人，无需付费")
                .font(.subheadline)
                .foregroundColor(AppTheme.textSecondary)
            Button(action: onCreate) {
                Text(languageCode == "en" ? "Create Now" : "立即创建")
                    .font(.body.weight(.semibold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(AppTheme.primary)
                    .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.medium))
            }
            .padding(.top, 4)
        }
        .padding(AppTheme.Spacing.lg)
        .background(AppTheme.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.medium))
    }

    private var joinCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "person.badge.plus.fill")
                    .foregroundColor(AppTheme.textPrimary)
                    .font(.system(size: 20))
                Text(languageCode == "en" ? "Join an existing group" : "加入已有家庭组")
                    .font(.headline)
            }
            Text(languageCode == "en"
                 ? "If a family member already created a group, paste the invite code here."
                 : "家人已创建家庭组？在这里输入邀请码加入")
                .font(.subheadline)
                .foregroundColor(AppTheme.textSecondary)
            Button(action: onRedeem) {
                Text(languageCode == "en" ? "Enter Invite Code" : "输入邀请码")
                    .font(.body.weight(.semibold))
                    .foregroundColor(AppTheme.primary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(AppTheme.primary.opacity(0.08))
                    .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.medium))
            }
            .padding(.top, 4)
        }
        .padding(AppTheme.Spacing.lg)
        .background(AppTheme.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.medium))
    }

    private var whatIsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(languageCode == "en" ? "What is Family Guard?" : "家庭守护是什么？")
                .font(.headline)
                .foregroundColor(AppTheme.primary)
            featureRow(
                icon: "📢",
                title: languageCode == "en" ? "Official broadcast" : "官方匿名广播",
                desc: languageCode == "en"
                    ? "AI auto-checks family queries; scams broadcast officially"
                    : "家人查询的诈骗信息，自动以官方名义通知全家"
            )
            featureRow(
                icon: "💚",
                title: languageCode == "en" ? "Care reminders" : "关怀提醒",
                desc: languageCode == "en"
                    ? "Push & SMS if a member hasn't opened the app for days"
                    : "家人连续未活跃时自动 push + 短信提醒你"
            )
            featureRow(
                icon: "👴",
                title: languageCode == "en" ? "Elder mode" : "长辈模式",
                desc: languageCode == "en"
                    ? "Big buttons + TTS + remote toggle for parents"
                    : "大按钮 + TTS 朗读，子女可远程为父母开启"
            )
        }
        .padding(AppTheme.Spacing.lg)
        .background(AppTheme.premiumWhyCard.opacity(0.4))
        .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.medium))
    }

    private func featureRow(icon: String, title: String, desc: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Text(icon).font(.title3)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline.weight(.semibold))
                Text(desc).font(.caption).foregroundColor(AppTheme.textSecondary)
            }
        }
    }
}
