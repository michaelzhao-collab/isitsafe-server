//
//  MemberCenterView.swift
//  IsItSafe
//
//  会员用户中心页，布局按设计图。带 [F] 的为后台配置下发的动态字段。
//

import SwiftUI

public struct MemberCenterView: View {
    @StateObject private var vm = ProfileViewModel()

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
        .navigationTitle("会员中心")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { vm.refresh() }
    }

    // MARK: - 用户信息区：头像、名称、PREMIUM MEMBER、管理订阅
    private var userSection: some View {
        HStack(alignment: .center, spacing: 14) {
            profileAvatar
            VStack(alignment: .leading, spacing: 6) {
                Text(vm.user?.nickname ?? "AI 资深研究员")
                    .font(.headline)
                    .foregroundColor(AppTheme.textPrimary)
                Text("PREMIUM MEMBER")
                    .font(.caption.weight(.semibold))
                    .foregroundColor(AppTheme.textPrimary)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(Color.yellow)
                    .clipShape(Capsule())
            }
            Spacer(minLength: 0)
            Button("管理订阅") {
                // 跳转系统订阅管理
            }
            .font(.subheadline)
            .foregroundColor(AppTheme.primary)
        }
        .padding(20)
        .background(AppTheme.cardBackground)
        .padding(.horizontal, 20)
        .padding(.top, 16)
        .padding(.bottom, 12)
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
                    .foregroundStyle(AppTheme.primary.opacity(0.5))
            }
        }
    }

    // MARK: - 当前状态卡片（深灰）：计划名 [F]、到期日 [F]
    private var statusCardSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("当前状态")
                    .font(.subheadline)
                    .foregroundColor(Color.white.opacity(0.7))
                Spacer()
                Image(systemName: "crown.fill")
                    .font(.system(size: 22))
                    .foregroundColor(.yellow)
            }
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text("年度订阅计划")
                    .font(.title2.bold())
                    .foregroundColor(.yellow)
                Text("[F]")
                    .font(.caption2)
                    .foregroundColor(Color.white.opacity(0.7))
            }
            Text("会员有效期至")
                .font(.caption)
                .foregroundColor(Color.white.opacity(0.7))
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(formattedExpireDate)
                    .font(.subheadline.weight(.medium))
                    .foregroundColor(.white)
                Text("[F]")
                    .font(.caption2)
                    .foregroundColor(Color.white.opacity(0.7))
            }
            HStack {
                Spacer()
                Text("正常续费中")
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
        guard let raw = vm.user?.subscriptionExpire, !raw.isEmpty else { return "2026年03月01日" }
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "zh_CN")
        guard let date = formatter.date(from: String(raw.prefix(10))) else { return raw }
        let out = DateFormatter()
        out.dateFormat = "yyyy年MM月dd日"
        out.locale = Locale(identifier: "zh_CN")
        return out.string(from: date)
    }

    // MARK: - 核心会员权益（6 宫格，标题与描述均为 [F]）
    private var coreBenefitsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 8) {
                Rectangle()
                    .fill(AppTheme.primary)
                    .frame(width: 4, height: 22)
                Text("核心会员权益")
                    .font(.headline)
                    .foregroundColor(AppTheme.textPrimary)
            }

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 14) {
                memberBenefitCard(icon: "magnifyingglass", iconColor: AppTheme.primary, title: "无限AI查询", subtitle: "彻底解锁额度限制")
                memberBenefitCard(icon: "wand.and.stars", iconColor: .purple, title: "高级AI模型", subtitle: "高性能推理引擎")
                memberBenefitCard(icon: "shield.exclamationmark", iconColor: .red, title: "实时数据库", subtitle: "秒级同步全球风险")
                memberBenefitCard(icon: "bolt.fill", iconColor: .green, title: "优先分析速度", subtitle: "云端GPU专属通道")
                memberBenefitCard(icon: "clock.arrow.circlepath", iconColor: .orange, title: "无限历史记录", subtitle: "云端保存永不丢失")
                memberBenefitCard(icon: "nosignature", iconColor: .purple, title: "清爽无广告", subtitle: "极致纯净体验")
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
