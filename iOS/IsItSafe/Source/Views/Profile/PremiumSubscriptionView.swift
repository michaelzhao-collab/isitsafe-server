//
//  PremiumSubscriptionView.swift
//  IsItSafe
//
//  非会员用户订阅页，布局与文案完全按设计图（图1+图2）。带 [F] 的为后台配置下发的动态字段。
//

import SwiftUI

// MARK: - 套餐项（展示用，[F] 字段后续对接 GET /api/membership/plans）
struct PremiumPlanItem: Identifiable {
    let id: String
    var name: String       // [F]
    var price: String      // [F] 如 "¥9.99"
    var description: String // [F]
    var tag: String?       // [F] 如 "最受欢迎"、"省45%"
    var tagColor: Color   // 标签背景色
    var isSelected: Bool
}

// MARK: - 主视图
public struct PremiumSubscriptionView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var selectedPlanId: String = "monthly"

    /// 占位数据，[F] 字段后续由服务端下发
    private let plans: [PremiumPlanItem] = [
        PremiumPlanItem(id: "weekly", name: "周订阅", price: "¥9.99", description: "适合短期体验", tag: nil, tagColor: .clear, isSelected: false),
        PremiumPlanItem(id: "monthly", name: "月订阅", price: "¥19.99", description: "热门首选", tag: "最受欢迎", tagColor: AppTheme.primary, isSelected: true),
        PremiumPlanItem(id: "yearly", name: "年订阅", price: "¥129.9", description: "高性价比推荐", tag: "省45%", tagColor: .orange, isSelected: false),
    ]

    public init() {}

    public var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(spacing: 0) {
                headerSection
                planCardsSection
                primaryButton
                coreBenefitsSection
                whyPremiumSection
                subscriptionNoticeSection
                bottomLinksSection
            }
        }
        .background(AppTheme.background)
        .navigationTitle("Premium")
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - 头部宣传区（深蓝背景）
    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("解锁完整分析能力")
                .font(.title.bold())
                .foregroundColor(.white)
                .frame(maxWidth: .infinity, alignment: .center)

            Text("升级 Premium 会员，通过高级 AI 引擎获得无限次深度风险查询与实时反诈提醒。")
                .font(.subheadline)
                .foregroundColor(.white.opacity(0.95))
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: 10) {
                Image(systemName: "crown.fill")
                    .font(.system(size: 18))
                    .foregroundColor(.yellow)
                Text("升级至 Premium 获得无限查询")
                    .font(.subheadline.weight(.medium))
                    .foregroundColor(AppTheme.textPrimary)
                Text(" [F]")
                    .font(.caption)
                    .foregroundColor(AppTheme.textSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(AppTheme.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .padding(.horizontal, 20)
        .padding(.top, 24)
        .padding(.bottom, 20)
        .frame(maxWidth: .infinity)
        .background(AppTheme.premiumHeader)
    }

    // MARK: - 订阅套餐选择（三个卡片，[F] 为下发展示）
    private var planCardsSection: some View {
        HStack(spacing: 12) {
            ForEach(plans) { plan in
                planCard(plan)
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 20)
        .padding(.bottom, 8)
        .background(AppTheme.premiumHeader)
    }

    private func planCard(_ plan: PremiumPlanItem) -> some View {
        let isSelected = plan.id == selectedPlanId
        return Button {
            withAnimation(.easeInOut(duration: 0.2)) { selectedPlanId = plan.id }
        } label: {
            VStack(alignment: .leading, spacing: 8) {
                if let tag = plan.tag, !tag.isEmpty {
                    Text(tag)
                        .font(.caption2.weight(.semibold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(plan.tagColor)
                        .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                } else {
                    Spacer().frame(height: 22)
                }
                Text(plan.name)
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(.white)
                Text(plan.price)
                    .font(.headline)
                    .foregroundColor(.white)
                Text(plan.description)
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.9))
                Text(" [F]")
                    .font(.caption2)
                    .foregroundColor(.white.opacity(0.7))
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .frame(minHeight: 100)
            .padding(14)
            .background(isSelected ? Color.white.opacity(0.28) : Color.white.opacity(0.06))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(isSelected ? AppTheme.primary : Color.white.opacity(0.35), lineWidth: isSelected ? 3 : 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .scaleEffect(isSelected ? 1.02 : 1.0)
        }
        .buttonStyle(.plain)
    }

    // MARK: - 主按钮
    private var primaryButton: some View {
        Button {
            // 后续：发起 IAP
        } label: {
            Text("立即开启 Premium 权限")
                .font(.headline)
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
        }
        .background(AppTheme.premiumHeader)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .padding(.horizontal, 20)
        .padding(.top, 20)
        .padding(.bottom, 28)
    }

    // MARK: - 核心会员权益（6 宫格）
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
                benefitCard(icon: "magnifyingglass", iconColor: AppTheme.primary, title: "无限AI查询", subtitle: "彻底解锁额度限制")
                benefitCard(icon: "wand.and.stars", iconColor: .purple, title: "高级AI模型", subtitle: "高性能推理引擎")
                benefitCard(icon: "shield.exclamationmark", iconColor: .red, title: "实时数据库", subtitle: "秒级同步全球风险")
                benefitCard(icon: "bolt.fill", iconColor: .green, title: "优先分析速度", subtitle: "云端GPU专属通道")
                benefitCard(icon: "clock.arrow.circlepath", iconColor: .orange, title: "无限历史记录", subtitle: "云端保存永不丢失")
                benefitCard(icon: "nosignature", iconColor: .purple, title: "清爽无广告", subtitle: "极致纯净体验")
            }
        }
        .padding(20)
        .background(AppTheme.cardBackground)
        .padding(.horizontal, 20)
        .padding(.bottom, 20)
    }

    private func benefitCard(icon: String, iconColor: Color, title: String, subtitle: String, showNotActivated: Bool = true) -> some View {
        ZStack(alignment: .topTrailing) {
            VStack(alignment: .leading, spacing: 10) {
                Image(systemName: icon)
                    .font(.system(size: 24))
                    .foregroundColor(.white)
                    .frame(width: 44, height: 44)
                    .background(iconColor)
                    .clipShape(Circle())
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(AppTheme.textPrimary)
                Text(subtitle)
                    .font(.caption)
                    .foregroundColor(AppTheme.textSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(AppTheme.background)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

            if showNotActivated {
                Text("未开通")
                    .font(.caption2)
                    .foregroundColor(AppTheme.textSecondary)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 3)
                    .background(AppTheme.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: 4, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 4, style: .continuous)
                            .stroke(AppTheme.border, lineWidth: 1)
                    )
                    .padding(8)
            }
        }
    }

    // MARK: - 为什么选择 Premium?（浅蓝卡片，[F] 为下发展示）
    private var whyPremiumSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("为什么选择 Premium?")
                .font(.headline)
                .foregroundColor(AppTheme.textPrimary)
                .frame(maxWidth: .infinity, alignment: .center)

            Text("“我们致力于在全球范围内防御日益复杂的网络诈骗，这需要巨大的计算支持。”")
                .font(.subheadline)
                .foregroundColor(AppTheme.textSecondary)
                .italic()
            Text(" [F]")
                .font(.caption)
                .foregroundColor(AppTheme.textSecondary)

            VStack(alignment: .leading, spacing: 10) {
                bulletRow("高性能模型：调用具有数十亿参数的专用 AI，精准识别隐藏的风险逻辑。", showF: true)
                bulletRow("动态数据库：24小时不间断爬取并更新全球诈骗手段库，保持最高的预警精度。", showF: true)
                bulletRow("持续进化：您的每一笔订阅点击都将用于提升AI的防御水平，保护更多用户免受损失。", showF: true)
            }
        }
        .padding(20)
        .background(AppTheme.premiumWhyCard)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .padding(.horizontal, 20)
        .padding(.bottom, 24)
    }

    private func bulletRow(_ text: String, showF: Bool = false) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Circle()
                .fill(AppTheme.primary)
                .frame(width: 6, height: 6)
                .padding(.top, 6)
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(text)
                    .font(.subheadline)
                    .foregroundColor(AppTheme.textSecondary)
                if showF {
                    Text("[F]")
                        .font(.caption2)
                        .foregroundColor(AppTheme.textSecondary)
                }
            }
        }
    }

    // MARK: - 订阅须知（静态）
    private var subscriptionNoticeSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("订阅须知")
                .font(.headline)
                .foregroundColor(AppTheme.textPrimary)

            VStack(alignment: .leading, spacing: 10) {
                noticeRow("订阅将在当前周期结束前24小时自动续费，费用将从您的 Apple 账户中扣除。")
                noticeRow("您随时可以在 Apple 设备的“设置-个人账户-订阅管理”中取消订阅。")
                noticeRow("取消订阅后，会员权益将在当前有效周期结束后停止续费。")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .background(AppTheme.cardBackground)
        .padding(.horizontal, 20)
        .padding(.bottom, 24)
    }

    private func noticeRow(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Circle()
                .fill(AppTheme.textSecondary)
                .frame(width: 5, height: 5)
                .padding(.top, 6)
            Text(text)
                .font(.subheadline)
                .foregroundColor(AppTheme.textSecondary)
        }
    }

    // MARK: - 底部链接
    private var bottomLinksSection: some View {
        HStack(spacing: 24) {
            Button("服务协议") { }
                .font(.subheadline)
                .foregroundColor(AppTheme.primary)
            Button("隐私政策") { }
                .font(.subheadline)
                .foregroundColor(AppTheme.primary)
            Button("恢复购买") { }
                .font(.subheadline)
                .foregroundColor(AppTheme.primary)
        }
        .padding(.vertical, 24)
        .padding(.bottom, 32)
    }
}

#if DEBUG
struct PremiumSubscriptionView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack {
            PremiumSubscriptionView()
        }
    }
}
#endif
