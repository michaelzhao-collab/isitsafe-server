//
//  MemberCenterView.swift
//  IsItSafe
//
//  会员用户中心页，布局按设计图。带 [F] 的为后台配置下发的动态字段。
//

import SwiftUI

public struct MemberCenterView: View {
    @StateObject private var vm = ProfileViewModel()
    @StateObject private var subscriptionVM = SubscriptionViewModel()
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"

    /// 会员尊贵黄金色渐变（导航栏 + 上半部）
    private var memberCenterGoldGradient: LinearGradient {
        LinearGradient(
            colors: [Color(hex: "D4AF37"), Color(hex: "B8860B")],
            startPoint: .top,
            endPoint: .bottom
        )
    }

    public init() {}

    public var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(spacing: 0) {
                userSection
                statusCardSection
                coreBenefitsSection
                familyBenefitsSection
            }
        }
        .background(AppTheme.background)
        .navigationTitle(languageCode == "en" ? "Member Center" : "会员中心")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(memberCenterGoldGradient, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .onAppear {
            vm.refresh()
            subscriptionVM.loadStatus()
        }
    }

    // MARK: - 用户信息区：头像、名称、PREMIUM MEMBER、管理订阅（上半部黄金色）
    private var userSection: some View {
        HStack(alignment: .center, spacing: 14) {
            profileAvatar
            VStack(alignment: .leading, spacing: 6) {
                Text(memberDisplayName)
                    .font(.headline)
                    .foregroundColor(.white)
                Text(languageCode == "en" ? "PREMIUM MEMBER" : "高级会员")
                    .font(.caption.weight(.semibold))
                    .foregroundColor(Color(hex: "1A1A1A"))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(Color.yellow)
                    .clipShape(Capsule())
            }
            Spacer(minLength: 0)
        }
        .padding(20)
        .background(memberCenterGoldGradient)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .padding(.horizontal, 20)
        .padding(.top, 16)
        .padding(.bottom, 12)
    }

    private var memberDisplayName: String {
        guard let user = vm.user else { return languageCode == "en" ? "User" : "用户" }
        return user.defaultDisplayName(isEnglish: languageCode == "en")
    }

    private var profileAvatar: some View {
        Group {
            if let urlString = vm.user?.avatar, let url = URL(string: urlString) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    case .failure, .empty:
                        Image(systemName: "person.circle.fill")
                            .font(.system(size: 56))
                            .foregroundStyle(AppTheme.primary.opacity(0.5))
                    @unknown default:
                        EmptyView()
                    }
                }
                .frame(width: 56, height: 56)
                .clipShape(Circle())
            } else {
                Image(systemName: "person.circle.fill")
                    .font(.system(size: 56))
                    .foregroundStyle(.white.opacity(0.9))
            }
        }
    }

    // MARK: - 当前状态卡片：计划名、到期日，颜色按浅灰底面修正
    private var statusCardSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(languageCode == "en" ? "Current status" : "当前状态")
                    .font(.subheadline)
                    .foregroundColor(AppTheme.textSecondary)
                Spacer()
                Image(systemName: "crown.fill")
                    .font(.system(size: 22))
                    .foregroundColor(Color(hex: "D4AF37"))
            }
            Text(currentPlanTitle)
                .font(.title2.bold())
                .foregroundColor(AppTheme.textPrimary)
            Text(languageCode == "en" ? "Valid until" : "会员有效期至")
                .font(.caption)
                .foregroundColor(AppTheme.textSecondary)
            Text(formattedExpireDate)
                .font(.subheadline.weight(.medium))
                .foregroundColor(AppTheme.textPrimary)
            HStack {
                Spacer()
                Text(languageCode == "en" ? "Active" : "正常续费中")
                    .font(.caption.weight(.semibold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Color(hex: "34C759"))
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppTheme.premiumStatusCard)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .padding(.horizontal, 20)
        .padding(.top, 16)
        .padding(.bottom, 24)
    }

    private var formattedExpireDate: String {
        let raw = subscriptionVM.status?.expireTime ?? vm.user?.subscriptionExpire
        guard let raw, !raw.isEmpty else { return languageCode == "en" ? "--" : "--" }
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        guard let date = formatter.date(from: String(raw.prefix(10))) else { return raw }
        if languageCode == "en" {
            let out = DateFormatter()
            out.dateFormat = "yyyy-MM-dd"
            out.locale = Locale(identifier: "en_US_POSIX")
            return out.string(from: date)
        }
        let out = DateFormatter()
        out.dateFormat = "yyyy年MM月dd日"
        out.locale = Locale(identifier: "zh_CN")
        return out.string(from: date)
    }

    private var currentPlanTitle: String {
        let plan = (subscriptionVM.status?.planType ?? "").lowercased()
        switch plan {
        case "weekly": return languageCode == "en" ? "Weekly plan" : "周订阅计划"
        case "monthly": return languageCode == "en" ? "Monthly plan" : "月度订阅计划"
        case "yearly": return languageCode == "en" ? "Annual plan" : "年度订阅计划"
        default: return languageCode == "en" ? "Current plan" : "当前订阅计划"
        }
    }

    // MARK: - 核心会员权益（6 宫格，标题与描述均为 [F]）
    private var coreBenefitsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 8) {
                Rectangle()
                    .fill(AppTheme.brandGradient)
                    .frame(width: 4, height: 22)
                Text(languageCode == "en" ? "Premium benefits" : "核心会员权益")
                    .font(.headline)
                    .foregroundColor(AppTheme.textPrimary)
            }

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 14) {
                ForEach(PremiumBenefitCatalog.core(isEnglish: languageCode == "en")) { b in
                    memberBenefitCard(icon: b.icon, title: b.title, subtitle: b.subtitle)
                }
            }
        }
        .padding(20)
        .background(AppTheme.cardBackground)
        .padding(.horizontal, 20)
        .padding(.bottom, 24)
    }

    // MARK: - 家庭守护权益（V3-A 会员能开通的家庭功能）
    private var familyBenefitsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 8) {
                Rectangle()
                    .fill(AppTheme.brandGradient)
                    .frame(width: 4, height: 22)
                Text(languageCode == "en" ? "Family plan benefits" : "家庭套餐权益")
                    .font(.headline)
                    .foregroundColor(AppTheme.textPrimary)
            }

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 14) {
                ForEach(PremiumBenefitCatalog.family(isEnglish: languageCode == "en")) { b in
                    memberBenefitCard(icon: b.icon, title: b.title, subtitle: b.subtitle)
                }
            }
        }
        .padding(20)
        .background(AppTheme.cardBackground)
        .padding(.horizontal, 20)
        .padding(.bottom, 24)
    }

    /// 会员页权益卡片
    private func memberBenefitCard(icon: String, title: String, subtitle: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            // 与订阅页同一风格：品牌蓝图标 + 浅蓝底（原来每项一种颜色）
            Image(systemName: icon)
                .font(.system(size: 22, weight: .semibold))
                .foregroundColor(AppTheme.primaryTint)
                .frame(width: 44, height: 44)
                .background(AppTheme.primarySoft)
                .clipShape(Circle())
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundColor(AppTheme.textPrimary)
            Text(subtitle)
                .font(.caption)
                .foregroundColor(AppTheme.textSecondary)
                .lineLimit(2)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(AppTheme.background)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

#if DEBUG
struct MemberCenterView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack {
            MemberCenterView()
        }
    }
}
#endif
