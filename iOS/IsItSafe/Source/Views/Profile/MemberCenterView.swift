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
                Text("PREMIUM MEMBER")
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
        if let n = user.wechatNickname, !n.isEmpty { return n }
        if let n = user.nickname, !n.isEmpty { return n }
        if let phone = user.phone, !phone.isEmpty {
            let tail = phone.count >= 4 ? String(phone.suffix(4)) : phone
            return languageCode == "en" ? "User \(tail)" : "星识用户\(tail)"
        }
        if let email = user.email, !email.isEmpty {
            let tail = email.count >= 4 ? String(email.suffix(4)) : email
            return languageCode == "en" ? "User \(tail)" : "星识用户\(tail)"
        }
        return languageCode == "en" ? "User" : "用户"
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

    // MARK: - 当前状态卡片（深灰）：计划名 [F]、到期日 [F]
    private var statusCardSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(languageCode == "en" ? "Current status" : "当前状态")
                    .font(.subheadline)
                    .foregroundColor(Color.white.opacity(0.7))
                Spacer()
                Image(systemName: "crown.fill")
                    .font(.system(size: 22))
                    .foregroundColor(.yellow)
            }
            Text(currentPlanTitle)
                .font(.title2.bold())
                .foregroundColor(.yellow)
            Text(languageCode == "en" ? "Valid until" : "会员有效期至")
                .font(.caption)
                .foregroundColor(Color.white.opacity(0.7))
            Text(formattedExpireDate)
                .font(.subheadline.weight(.medium))
                .foregroundColor(.white)
            HStack {
                Spacer()
                Text(languageCode == "en" ? "Active" : "正常续费中")
                    .font(.caption)
                    .foregroundColor(AppTheme.textPrimary)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Color.white.opacity(0.25))
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
                    .fill(AppTheme.primary)
                    .frame(width: 4, height: 22)
                Text(languageCode == "en" ? "Premium benefits" : "核心会员权益")
                    .font(.headline)
                    .foregroundColor(AppTheme.textPrimary)
            }

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 14) {
                memberBenefitCard(icon: "magnifyingglass", iconColor: AppTheme.primary, title: languageCode == "en" ? "Unlimited AI checks" : "无限AI查询", subtitle: languageCode == "en" ? "No usage caps" : "彻底解锁额度限制")
                memberBenefitCard(icon: "wand.and.stars", iconColor: .purple, title: languageCode == "en" ? "Advanced AI" : "高级AI模型", subtitle: languageCode == "en" ? "High-performance engine" : "高性能推理引擎")
                memberBenefitCard(icon: "shield.exclamationmark", iconColor: .red, title: languageCode == "en" ? "Live risk database" : "实时数据库", subtitle: languageCode == "en" ? "Global risk data in real time" : "秒级同步全球风险")
                memberBenefitCard(icon: "bolt.fill", iconColor: .green, title: languageCode == "en" ? "Priority analysis" : "优先分析速度", subtitle: languageCode == "en" ? "Dedicated cloud processing" : "云端GPU专属通道")
                memberBenefitCard(icon: "clock.arrow.circlepath", iconColor: .orange, title: languageCode == "en" ? "Unlimited history" : "无限历史记录", subtitle: languageCode == "en" ? "Saved in the cloud" : "云端保存永不丢失")
                memberBenefitCard(icon: "nosignature", iconColor: .purple, title: languageCode == "en" ? "No ads" : "清爽无广告", subtitle: languageCode == "en" ? "Clean experience" : "极致纯净体验")
            }
        }
        .padding(20)
        .background(AppTheme.cardBackground)
        .padding(.horizontal, 20)
        .padding(.bottom, 24)
    }

    /// 会员页权益卡片（无「未开通」角标，标题与描述后带 [F]）
    private func memberBenefitCard(icon: String, iconColor: Color, title: String, subtitle: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 24))
                .foregroundColor(.white)
                .frame(width: 44, height: 44)
                .background(iconColor)
                .clipShape(Circle())
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(AppTheme.textPrimary)
                Text("[F]")
                    .font(.caption2)
                    .foregroundColor(AppTheme.textSecondary)
            }
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(subtitle)
                    .font(.caption)
                    .foregroundColor(AppTheme.textSecondary)
                Text("[F]")
                    .font(.caption2)
                    .foregroundColor(AppTheme.textSecondary)
            }
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
