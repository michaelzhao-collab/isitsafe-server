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
                // 防止底导（MainTabView 自定义 tabBar ~78pt + 安全区）遮挡最后一段
                Color.clear.frame(height: 120)
            }
            .padding(AppTheme.Spacing.lg)
        }
        .background(AppTheme.background)
    }

    /// hero：用蓝渐变 + SF Symbol 大图，替代之前的 emoji 👨‍👩‍👧‍👦
    private var heroSection: some View {
        VStack(spacing: 14) {
            ZStack {
                // 蓝色径向渐变光晕（呼应 App 主色）
                Circle()
                    .fill(LinearGradient(
                        colors: [AppTheme.primary.opacity(0.18), AppTheme.primary.opacity(0.04)],
                        startPoint: .top, endPoint: .bottom
                    ))
                    .frame(width: 110, height: 110)
                // 实心圆背景 + 白色 SF Symbol
                Circle()
                    .fill(LinearGradient(
                        colors: [AppTheme.primary, AppTheme.premiumHeader],
                        startPoint: .topLeading, endPoint: .bottomTrailing
                    ))
                    .frame(width: 84, height: 84)
                    .shadow(color: AppTheme.primary.opacity(0.25), radius: 12, x: 0, y: 6)
                Image(systemName: "shield.lefthalf.filled")
                    .font(.system(size: 38, weight: .semibold))
                    .foregroundColor(.white)
            }
            .padding(.top, 16)

            Text(languageCode == "en" ? "Family Guard" : "家庭守护")
                .font(.system(size: 28, weight: .bold))
                .foregroundColor(AppTheme.textPrimary)
            Text(languageCode == "en"
                 ? "Free to create. Look after each other."
                 : "免费创建，全家互相守护")
                .font(.subheadline)
                .foregroundColor(AppTheme.textSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
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
                 ? "Free up to 3 members · Upgrade to Pro for up to 10"
                 : "免费 3 人 · 升级 Pro 最多 10 人")
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
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 8) {
                Image(systemName: "questionmark.circle.fill")
                    .font(.system(size: 20))
                    .foregroundColor(AppTheme.primary)
                Text(languageCode == "en" ? "What is Family Guard?" : "家庭守护是什么？")
                    .font(.headline)
                    .foregroundColor(AppTheme.textPrimary)
            }
            featureRow(
                sfIcon: "megaphone.fill",
                iconColor: AppTheme.primary,
                title: languageCode == "en" ? "Anonymous family alerts" : "家庭匿名广播",
                desc: languageCode == "en"
                    ? "When one family member checks a scam, the rest get an instant heads-up (anonymous)"
                    : "家人查到诈骗时，其他人会立刻收到匿名提醒"
            )
            featureRow(
                sfIcon: "heart.fill",
                iconColor: AppTheme.riskHigh,
                title: languageCode == "en" ? "Care reminders" : "关怀提醒",
                desc: languageCode == "en"
                    ? "If a family member hasn't opened the app for days, push & SMS reminders"
                    : "家人长时间没打开 App，会自动推送 + 短信提醒你"
            )
            featureRow(
                sfIcon: "person.crop.circle.fill.badge.checkmark",
                iconColor: AppTheme.riskMedium,
                title: languageCode == "en" ? "Elder mode" : "长辈模式",
                desc: languageCode == "en"
                    ? "Large buttons + voice reading + remote enable for parents from your phone"
                    : "大按钮 + 语音朗读，你能在自己手机上远程为父母开启"
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

    private func featureRow(sfIcon: String, iconColor: Color, title: String, desc: String) -> some View {
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
}
