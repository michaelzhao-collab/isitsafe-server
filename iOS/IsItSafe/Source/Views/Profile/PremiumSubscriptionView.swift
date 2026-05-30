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
    var period: String     // 如 "weekly"/"monthly"/"yearly"
    var description: String // [F]
    var tag: String?       // [F] 如 "最受欢迎"、"省45%"
    var tagColor: Color   // 标签背景色
    var isRecommended: Bool // 后台是否标记为推荐（用于默认选中）
    var isSelected: Bool
}

// MARK: - 主视图
public struct PremiumSubscriptionView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    @EnvironmentObject private var appState: AppStateViewModel
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    @StateObject private var subscriptionVM = SubscriptionViewModel()
    @State private var plans: [PremiumPlanItem] = []
    @State private var selectedPlanId: String = ""
    @State private var loading = true
    @State private var loadError: String?
    @State private var shouldAutoCloseWhenActivated = false
    private let onSubscribed: (() -> Void)?

    public init(onSubscribed: (() -> Void)? = nil) {
        self.onSubscribed = onSubscribed
    }

    public var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(spacing: 0) {
                headerSection
                if loading && plans.isEmpty {
                    ProgressView()
                        .padding(.vertical, 40)
                } else if let err = loadError, plans.isEmpty {
                    Text(err)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .padding()
                } else {
                    planCardsSection
                }
                if !plans.isEmpty { primaryButton }
                coreBenefitsSection
                familyBenefitsSection
                whyPremiumSection
                subscriptionNoticeSection
                bottomLinksSection
            }
        }
        .background(AppTheme.background)
        .navigationTitle("Premium")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(AppTheme.premiumHeader, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        // MainTabView 底导是覆盖层，给订阅页补底部留白，避免底部链接被挡住
        .safeAreaInset(edge: .bottom) {
            Color.clear.frame(height: 92)
        }
        .task { await loadPlans() }
        .onChange(of: subscriptionVM.purchaseState) { _, newValue in
            if newValue == .purchased {
                AppStateViewModel.shared.showSuccess(languageCode == "en" ? "Subscribed successfully" : "开通成功")
                onSubscribed?()
                dismiss()
                subscriptionVM.resetPurchaseState()
            }
        }
        .onChange(of: appState.subscriptionActive) { _, active in
            guard active, shouldAutoCloseWhenActivated else { return }
            onSubscribed?()
            dismiss()
        }
        .onAppear {
            // 仅在“进入时还不是会员”的场景，订阅激活后自动关闭当前页
            shouldAutoCloseWhenActivated = !appState.subscriptionActive
        }
    }

    private func loadPlans() async {
        loading = true
        loadError = nil
        defer { loading = false }
        do {
            let list = try await SubscriptionService.shared.fetchPlans()
            let items = list.map { api -> PremiumPlanItem in
                let pid = api.productId.trimmingCharacters(in: .whitespacesAndNewlines)
                let tag: String?
                let tagColor: Color
                if api.isRecommended == true {
                    tag = languageCode == "en" ? "Most Popular" : "最受欢迎"
                    tagColor = AppTheme.primary
                } else if api.firstPurchaseOnly == true, api.introPrice != nil {
                    tag = languageCode == "en" ? "First-purchase offer" : "首购优惠"
                    tagColor = .pink
                } else if api.period.lowercased() == "yearly" {
                    tag = languageCode == "en" ? "Save 45%" : "省45%"
                    tagColor = .orange
                } else {
                    tag = nil
                    tagColor = .clear
                }
                return PremiumPlanItem(
                    id: pid,
                    name: api.name,
                    price: formatPrice(api),
                    period: api.period,
                    description: descriptionForPeriod(api.period),
                    tag: tag,
                    tagColor: tagColor,
                    isRecommended: api.isRecommended == true,
                    isSelected: false
                )
            }
            await MainActor.run {
                plans = items
                // 默认选中推荐项；若多个推荐则选列表中第一个（服务端已按 sortOrder 排序，即权重最高）
                let defaultId = items.first(where: { $0.isRecommended })?.id ?? items.first?.id ?? ""
                if selectedPlanId.isEmpty {
                    selectedPlanId = defaultId
                } else if !items.contains(where: { $0.id == selectedPlanId }) {
                    selectedPlanId = defaultId
                }
            }
        } catch {
            await MainActor.run {
                loadError = (error as? APIError)?.userMessage ?? (languageCode == "en" ? "Failed to load plans" : "加载套餐失败")
            }
        }
    }

    private func formatPrice(_ api: MembershipPlanResponse) -> String {
        if api.currency.uppercased() == "CNY" || api.currency == "¥" {
            return String(format: "¥%.2f", api.price)
        }
        return String(format: "%@ %.2f", api.currency, api.price)
    }

    private func descriptionForPeriod(_ period: String) -> String {
        let en = languageCode == "en"
        switch period.lowercased() {
        case "weekly": return en ? "Short-term trial" : "适合短期体验"
        case "monthly": return en ? "Most popular" : "热门首选"
        case "yearly": return en ? "Best value" : "高性价比推荐"
        default: return en ? "Member benefits" : "会员权益"
        }
    }

    private var autoRenewNoticeText: String {
        guard let plan = plans.first(where: { $0.id == selectedPlanId }) else { return "" }
        let en = languageCode == "en"
        let periodLabel: String
        switch plan.period.lowercased() {
        case "weekly":  periodLabel = en ? "week"   : "周"
        case "monthly": periodLabel = en ? "month"  : "月"
        case "yearly":  periodLabel = en ? "year"   : "年"
        default:        periodLabel = en ? "period" : "期"
        }
        if en {
            return "\(plan.price)/\(periodLabel) · Auto-renews. Cancel anytime."
        } else {
            return "\(plan.price)/\(periodLabel) 自动续费，随时取消订阅"
        }
    }

    // MARK: - 头部宣传区（深蓝背景）
    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(languageCode == "en" ? "Unlock full analysis" : "解锁完整分析能力")
                .font(.title.bold())
                .foregroundColor(.white)
                .frame(maxWidth: .infinity, alignment: .center)

            Text(languageCode == "en" ? "Upgrade to Premium for unlimited risk checks and real-time fraud alerts powered by advanced AI." : "升级 Premium 会员，通过高级 AI 引擎获得无限次深度风险查询与实时反诈提醒。")
                .font(.subheadline)
                .foregroundColor(.white.opacity(0.95))
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: 10) {
                Image(systemName: "crown.fill")
                    .font(.system(size: 18))
                    .foregroundColor(.yellow)
                Text(languageCode == "en" ? "Unlimited queries with Premium" : "升级至 Premium 获得无限查询")
                    .font(.subheadline.weight(.medium))
                    .foregroundColor(AppTheme.textPrimary)
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
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                ForEach(plans) { plan in
                    planCard(plan)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 20)

            if !autoRenewNoticeText.isEmpty {
                Text(autoRenewNoticeText)
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.75))
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 10)
                    .padding(.horizontal, 20)
            }
        }
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

    // MARK: - 主按钮（IAP 购买 + 服务端核验）
    private var primaryButton: some View {
        VStack(spacing: 12) {
            Button {
                guard AuthService.shared.isLoggedIn else {
                    AppStateViewModel.shared.showError(languageCode == "en" ? "Please log in to subscribe" : "请先登录后再购买")
                    return
                }
                guard !selectedPlanId.isEmpty else { return }
                subscriptionVM.purchase(productId: selectedPlanId)
            } label: {
                Group {
                    if subscriptionVM.purchaseState == .purchasing {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 16)
                    } else {
                        Text(languageCode == "en" ? "Subscribe to Premium" : "立即开启 Premium 权限")
                            .font(.headline)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 16)
                    }
                }
            }
            .disabled(subscriptionVM.purchaseState == .purchasing)
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
                Text(languageCode == "en" ? "Premium benefits" : "核心会员权益")
                    .font(.headline)
                    .foregroundColor(AppTheme.textPrimary)
            }

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 14) {
                benefitCard(icon: "magnifyingglass", iconColor: AppTheme.primary, title: languageCode == "en" ? "Unlimited AI checks" : "无限AI查询", subtitle: languageCode == "en" ? "No usage caps" : "彻底解锁额度限制")
                benefitCard(icon: "wand.and.stars", iconColor: .purple, title: languageCode == "en" ? "Advanced AI" : "高级AI模型", subtitle: languageCode == "en" ? "High-performance engine" : "高性能推理引擎")
                benefitCard(icon: "shield.exclamationmark", iconColor: .red, title: languageCode == "en" ? "Live risk database" : "实时数据库", subtitle: languageCode == "en" ? "Global risk data in real time" : "秒级同步全球风险")
                benefitCard(icon: "bolt.fill", iconColor: .green, title: languageCode == "en" ? "Priority analysis" : "优先分析速度", subtitle: languageCode == "en" ? "Dedicated cloud processing" : "云端GPU专属通道")
                benefitCard(icon: "clock.arrow.circlepath", iconColor: .orange, title: languageCode == "en" ? "Unlimited history" : "无限历史记录", subtitle: languageCode == "en" ? "Saved in the cloud" : "云端保存永不丢失")
                benefitCard(icon: "nosignature", iconColor: .purple, title: languageCode == "en" ? "No ads" : "清爽无广告", subtitle: languageCode == "en" ? "Clean experience" : "极致纯净体验")
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
                Text(languageCode == "en" ? "Not active" : "未开通")
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

    // MARK: - 家庭套餐权益（S5-11 新增）
    /// PRD V3-E：family.* 订阅 = owner 付费 → 同家庭全员共享配额
    private var familyBenefitsSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                Rectangle()
                    .fill(AppTheme.primary)
                    .frame(width: 4, height: 22)
                Text(languageCode == "en" ? "Family plan benefits" : "家庭套餐权益")
                    .font(.headline)
                    .foregroundColor(AppTheme.textPrimary)
                Spacer()
                Text(languageCode == "en" ? "Up to 10 people" : "最多 10 人")
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background(AppTheme.primary.opacity(0.12))
                    .foregroundColor(AppTheme.primary)
                    .clipShape(Capsule())
            }

            // F10：与"核心会员权益"对齐，改 2 列网格卡片
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 14) {
                benefitCard(
                    icon: "person.3.fill",
                    iconColor: AppTheme.primary,
                    title: languageCode == "en" ? "10 members/group" : "最多 10 人/家",
                    subtitle: languageCode == "en" ? "Free 3, Pro 10 — multi-gen" : "免费 3 人，多代家庭"
                )
                benefitCard(
                    icon: "infinity",
                    iconColor: .green,
                    title: languageCode == "en" ? "Shared AI checks" : "全家共享 AI",
                    subtitle: languageCode == "en" ? "Owner pays, all get Pro" : "owner 付费全家 Pro"
                )
                benefitCard(
                    icon: "megaphone.fill",
                    iconColor: .red,
                    title: languageCode == "en" ? "Unlimited broadcasts" : "官方提醒不限次",
                    subtitle: languageCode == "en" ? "Free 1/day, Pro unlimited" : "免费 1 条/天"
                )
                benefitCard(
                    icon: "house.fill",
                    iconColor: .orange,
                    title: languageCode == "en" ? "Up to 3 groups" : "最多 3 个家庭",
                    subtitle: languageCode == "en" ? "Manage spouse / parents" : "管伴侣 / 父母家"
                )
                benefitCard(
                    icon: "heart.text.square",
                    iconColor: .purple,
                    title: languageCode == "en" ? "SMS care escalation" : "关怀短信升级",
                    subtitle: languageCode == "en" ? "Reach silent elderly users" : "长辈 2 天没看 → 短信"
                )
            }
        }
        .padding(20)
        .background(AppTheme.cardBackground)
        .padding(.horizontal, 20)
        .padding(.bottom, 20)
    }

    // MARK: - 为什么选择 Premium?（浅蓝卡片，[F] 为下发展示）
    private var whyPremiumSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(languageCode == "en" ? "Why Premium?" : "为什么选择 Premium?")
                .font(.headline)
                .foregroundColor(AppTheme.textPrimary)
                .frame(maxWidth: .infinity, alignment: .center)

            Text(languageCode == "en" ? "We are committed to fighting complex online fraud globally, which requires significant computing power." : "我们致力于在全球范围内防御日益复杂的网络诈骗，这需要巨大的计算支持。")
                .font(.subheadline)
                .foregroundColor(AppTheme.textSecondary)
                .italic()

            VStack(alignment: .leading, spacing: 10) {
                bulletRow(languageCode == "en" ? "Advanced AI: Billions of parameters for accurate risk detection." : "高性能模型：调用具有数十亿参数的专用 AI，精准识别隐藏的风险逻辑。", showF: false)
                bulletRow(languageCode == "en" ? "Live database: 24/7 global fraud intelligence, always up to date." : "动态数据库：24小时不间断爬取并更新全球诈骗手段库，保持最高的预警精度。", showF: false)
                bulletRow(languageCode == "en" ? "Evolving protection: Your subscription helps improve AI and protect more users." : "持续进化：您的每一笔订阅点击都将用于提升AI的防御水平，保护更多用户免受损失。", showF: false)
            }
        }
        .padding(20)
        .background(colorScheme == .dark ? AppTheme.cardBackground : AppTheme.premiumWhyCard)
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

    // MARK: - 订阅须知
    private var subscriptionNoticeSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(languageCode == "en" ? "Subscription terms" : "订阅须知")
                .font(.headline)
                .foregroundColor(AppTheme.textPrimary)

            VStack(alignment: .leading, spacing: 10) {
                noticeRow(languageCode == "en" ? "Your subscription will renew automatically within 24 hours before the end of the current period. Payment will be charged to your Apple account." : "订阅将在当前周期结束前24小时自动续费，费用将从您的 Apple 账户中扣除。")
                noticeRow(languageCode == "en" ? "You can cancel anytime in Settings > [Your Name] > Subscriptions on your Apple device." : "您随时可以在 Apple 设备的“设置-个人账户-订阅管理”中取消订阅。")
                noticeRow(languageCode == "en" ? "After cancellation, benefits continue until the end of the current period." : "取消订阅后，会员权益将在当前有效周期结束后停止续费。")
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
            NavigationLink(languageCode == "en" ? "Terms of Service" : "服务协议") {
                InAppWebView(url: AppTheme.termsURL, title: languageCode == "en" ? "User Agreement" : "用户协议")
            }
            .font(.subheadline)
            .foregroundColor(AppTheme.primary)
            NavigationLink(languageCode == "en" ? "Privacy Policy" : "隐私政策") {
                InAppWebView(url: AppTheme.privacyURL, title: languageCode == "en" ? "Privacy Policy" : "隐私政策")
            }
            .font(.subheadline)
            .foregroundColor(AppTheme.primary)
            NavigationLink("EULA") {
                InAppWebView(
                    url: URL(string: "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")!,
                    title: "EULA"
                )
            }
            .font(.subheadline)
            .foregroundColor(AppTheme.primary)
            Button(languageCode == "en" ? "Restore Purchases" : "恢复购买") {
                subscriptionVM.restorePurchases()
            }
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
