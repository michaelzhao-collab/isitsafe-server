//
//  FamilyGroupView.swift
//  IsItSafe
//
//  V3-E 已加入家庭组的主视图（E-P1）
//
//  S5-7 布局重新设计（按用户反馈）：
//   - 解散 / 退出 入口太显眼 → 收进右上角 toolbar Menu（⋯）
//   - 分享信息按钮太强 → 柔和样式（浅蓝填充 + 蓝字 + 蓝色 icon）
//   - 邀请家人 → 成员列表末尾加 +邀请家人 占位行（owner 可见）+ 菜单里也有
//
//  顶部 toolbar 由外层 FamilyView 的 NavigationStack 接管
//

import SwiftUI

public struct FamilyGroupView: View {
    public let group: FamilyGroup
    @ObservedObject var vm: FamilyViewModel
    @EnvironmentObject private var appState: AppStateViewModel
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    @State private var showInviteSheet = false
    @State private var showLeaveConfirm = false
    @State private var showDissolveConfirm = false
    @State private var showShareSheet = false
    @State private var showPrivacy = false
    @State private var showSwitchSheet = false
    @State private var showRedeemSheet = false
    /// S5-9 家庭官方消息（来自自己或其他成员的分享，AI 检测后官方匿名广播）
    @State private var recentBroadcasts: [FamilyBroadcast] = []
    /// 用户主动关闭"最近家庭消息" section
    /// 持久化策略：UserDefaults 存"当时最新一条 broadcast id"。下次新广播到达 id 变化 → 自动再现
    @State private var hideRecentBroadcasts: Bool = false
    @State private var loadingBroadcasts = false

    public init(group: FamilyGroup, vm: FamilyViewModel) {
        self.group = group
        self.vm = vm
    }

    public var body: some View {
        // 之前用 .safeAreaInset(.bottom) 不可见：MainTabView 自定义 tabBar 用 .ignoresSafeArea 覆盖在
        // NavigationStack 上方，把 safeAreaInset 的按钮挡死。改 ZStack + 显式 bottom padding。
        ZStack(alignment: .bottom) {
            ScrollView {
                VStack(spacing: AppTheme.Spacing.md) {
                    headerCard
                    broadcastSection
                    memberSection
                }
                .padding(AppTheme.Spacing.lg)
                // 给底部留出浮动按钮高度，免得内容被挡住
                .padding(.bottom, 60)
            }

            // 浮动分享栏：贴在 MainTabView tabBar 上方
            VStack(spacing: 0) {
                Divider().opacity(0.5)
                shareAction
                    .padding(.horizontal, 16)
                    .padding(.top, 10)
                    .padding(.bottom, 12)
            }
            .background(Color(.systemBackground))
            // MainTabView tabBar 高度约 78pt（6 top + ~46 content + 12 bottom + ~14 home indicator）
            .padding(.bottom, 78)
        }
        .background(AppTheme.background)
        .task(id: group.id) {
            // #10：family 切换 / 视图重建时都会重新拉，确保 B 视角能看到 A 发的最新消息
            await loadBroadcasts()
        }
        .onAppear {
            // tab 切回时（已有 view 实例）也强制刷一次（.task 不会再触发）
            Task { await loadBroadcasts() }
        }
        .refreshable {
            await loadBroadcasts()
            vm.refresh()
        }
        // 左上角"切换家庭"按钮（仅当有多个家庭时显示）+ 右上角 ⋯ Menu
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                if vm.allGroups.count > 1 {
                    // #2：与⋯菜单 ellipsis.circle 统一风格 — 纯 SF Symbol
                    Button {
                        showSwitchSheet = true
                    } label: {
                        Image(systemName: "arrow.left.arrow.right.circle")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundColor(AppTheme.textPrimary)
                    }
                }
            }
            ToolbarItem(placement: .navigationBarTrailing) {
                Menu {
                    // 多家庭场景：菜单里也有"切换家庭"
                    if vm.allGroups.count > 1 {
                        Button {
                            showSwitchSheet = true
                        } label: {
                            Label(
                                languageCode == "en" ? "Switch Family" : "切换家庭",
                                systemImage: "arrow.left.arrow.right"
                            )
                        }
                        Divider()
                    }
                    // S5-12：任一成员都可发邀请码（删 owner 限制）
                    if !group.isFull {
                        Button {
                            showInviteSheet = true
                        } label: {
                            Label(
                                languageCode == "en" ? "Invite Family" : "邀请家人",
                                systemImage: "person.badge.plus"
                            )
                        }
                    }
                    // 用邀请码加入别人的家庭（多家庭场景核心入口）
                    Button {
                        showRedeemSheet = true
                    } label: {
                        Label(
                            languageCode == "en" ? "Join Another Family" : "加入其他家庭",
                            systemImage: "rectangle.portrait.and.arrow.forward"
                        )
                    }
                    Button {
                        showPrivacy = true
                    } label: {
                        Label(
                            languageCode == "en" ? "Privacy Settings" : "隐私设置",
                            systemImage: "lock.shield"
                        )
                    }
                    Divider()
                    if group.isOwner {
                        Button(role: .destructive) {
                            showDissolveConfirm = true
                        } label: {
                            Label(
                                languageCode == "en" ? "Dissolve Group" : "解散家庭组",
                                systemImage: "xmark.circle"
                            )
                        }
                    } else {
                        Button(role: .destructive) {
                            showLeaveConfirm = true
                        } label: {
                            Label(
                                languageCode == "en" ? "Leave Group" : "退出家庭组",
                                systemImage: "rectangle.portrait.and.arrow.right"
                            )
                        }
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundColor(AppTheme.textPrimary)
                }
            }
        }
        .sheet(isPresented: $showInviteSheet) {
            InviteFamilySheet(group: group, vm: vm)
        }
        .sheet(isPresented: $showShareSheet) {
            ShareToFamilySheet(vm: vm)
        }
        .sheet(isPresented: $showPrivacy) {
            FamilyPrivacySheet(vm: vm)
        }
        .sheet(isPresented: $showSwitchSheet) {
            FamilySwitchSheet(vm: vm)
        }
        .sheet(isPresented: $showRedeemSheet) {
            RedeemInviteSheet(vm: vm)
        }
        .confirmationDialog(
            languageCode == "en" ? "Leave family group?" : "退出家庭组？",
            isPresented: $showLeaveConfirm
        ) {
            Button(languageCode == "en" ? "Leave" : "确认退出", role: .destructive) {
                Task { await vm.leaveGroup(groupId: group.id) }
            }
            Button(languageCode == "en" ? "Cancel" : "取消", role: .cancel) {}
        }
        .confirmationDialog(
            languageCode == "en" ? "Dissolve this group?" : "解散家庭组？",
            isPresented: $showDissolveConfirm
        ) {
            Button(languageCode == "en" ? "Dissolve" : "确认解散", role: .destructive) {
                Task { await vm.dissolveGroup(groupId: group.id) }
            }
            Button(languageCode == "en" ? "Cancel" : "取消", role: .cancel) {}
        } message: {
            Text(languageCode == "en"
                 ? "All members will leave; cannot be undone."
                 : "所有成员将退出，操作不可撤销")
        }
    }

    // MARK: - Header

    private var headerCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(languageCode == "en" ? "My Family Group" : "我的家庭组")
                        .font(.caption).opacity(0.85)
                    Text(group.displayName)
                        .font(.title3.weight(.bold))
                        .lineLimit(1)
                }
                Spacer()
                tierBadge
            }
            HStack {
                Image(systemName: "person.2.fill")
                    .font(.caption2).opacity(0.9)
                Text(memberCountText)
                    .font(.caption).opacity(0.9)
                Spacer()
                Image(systemName: "megaphone.fill")
                    .font(.caption2).opacity(0.9)
                Text(todayBroadcastText)
                    .font(.caption).opacity(0.9)
            }
        }
        .foregroundColor(.white)
        .padding(AppTheme.Spacing.lg)
        .background(
            LinearGradient(colors: [AppTheme.primary, AppTheme.premiumHeader],
                           startPoint: .topLeading, endPoint: .bottomTrailing)
        )
        .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.medium))
    }

    /// 免费 / Pro 徽章（免费状态可点 → 跳订阅页升级）
    private var tierBadge: some View {
        let isPro = appState.subscriptionActive
        let text: String = isPro
            ? (languageCode == "en" ? "Pro" : "Pro")
            : (languageCode == "en" ? "Free" : "免费 ›")
        return Group {
            if isPro {
                Text(text)
                    .font(.caption.weight(.bold))
                    .padding(.horizontal, 10).padding(.vertical, 4)
                    .background(Color.white.opacity(0.28))
                    .clipShape(Capsule())
            } else {
                NavigationLink {
                    PremiumSubscriptionView()
                        .environmentObject(appState)
                        .mainTabBarHidden()
                } label: {
                    Text(text)
                        .font(.caption.weight(.bold))
                        .padding(.horizontal, 10).padding(.vertical, 4)
                        .background(Color.white.opacity(0.18))
                        .foregroundColor(.white)
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var memberCountText: String {
        // group.maxMembers 由 server 端按 owner 订阅状态动态下发：免费 3 / Pro 10
        if languageCode == "en" {
            return "\(group.memberCount) / \(group.maxMembers) members"
        }
        return "\(group.memberCount) / \(group.maxMembers) 名成员"
    }

    // MARK: - Broadcasts（S5-9 家庭官方消息显示入口）

    /// 按用户+家庭组维度持久化"关闭最新消息"的 broadcast id
    /// 关闭后只要 newest broadcast id 还等于这个值，section 就不展示
    /// 一旦有新广播到达，newest 变化 → 自动再次展示
    private var dismissedLatestKey: String {
        let uid = UserSessionStore.shared.currentUser?.id ?? "guest"
        return "family.dismissedLatestBroadcast.\(uid).\(group.id)"
    }
    private func computeHideRecentBroadcasts() -> Bool {
        guard let latest = recentBroadcasts.first else { return false }
        let stored = UserDefaults.standard.string(forKey: dismissedLatestKey)
        return stored == latest.id
    }
    private func dismissRecentBroadcasts() {
        if let latest = recentBroadcasts.first {
            UserDefaults.standard.set(latest.id, forKey: dismissedLatestKey)
        }
        withAnimation { hideRecentBroadcasts = true }
    }

    @ViewBuilder
    private var broadcastSection: some View {
        // 入口常驻：只要有任意消息（历史 + 最近）都展示入口栏
        // X 只折叠 3 条预览，"查看全部 →"始终可点进 FamilyBroadcastListView
        if !recentBroadcasts.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Image(systemName: "megaphone.fill")
                        .font(.caption)
                        .foregroundColor(AppTheme.primary)
                    Text(languageCode == "en" ? "Family Messages" : "家庭消息")
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(AppTheme.textSecondary)
                    Text("(\(recentBroadcasts.count))")
                        .font(.caption)
                        .foregroundColor(AppTheme.textSecondary)
                    Spacer()
                    // 入口常驻：去查看全部历史消息
                    NavigationLink {
                        FamilyBroadcastListView(broadcasts: recentBroadcasts)
                    } label: {
                        HStack(spacing: 2) {
                            Text(languageCode == "en" ? "View all" : "查看全部")
                            Image(systemName: "chevron.right").font(.caption2)
                        }
                        .font(.caption)
                        .foregroundColor(AppTheme.primary)
                    }
                    // 预览折叠按钮（不影响入口；可再次点击展开）
                    Button {
                        if hideRecentBroadcasts {
                            // 重新展开 — 清掉持久化的隐藏标记
                            UserDefaults.standard.removeObject(forKey: dismissedLatestKey)
                            withAnimation { hideRecentBroadcasts = false }
                        } else {
                            dismissRecentBroadcasts()
                        }
                    } label: {
                        Image(systemName: hideRecentBroadcasts ? "chevron.down" : "xmark")
                            .font(.caption2.weight(.semibold))
                            .foregroundColor(AppTheme.textSecondary)
                            .padding(4)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
                if !hideRecentBroadcasts {
                    VStack(spacing: 0) {
                        ForEach(Array(recentBroadcasts.prefix(3).enumerated()), id: \.element.id) { idx, bc in
                            broadcastRow(bc)
                            if idx < min(2, recentBroadcasts.count - 1) {
                                Divider().padding(.leading, 36)
                            }
                        }
                    }
                    .background(AppTheme.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.medium))
                }
            }
        }
        // #4：去掉这里独立的 loading（之前用户反馈"家庭成员"下方出现的多余 loading）
        // broadcastSection 加载完前直接不渲染，避免视觉混乱
    }

    private func broadcastRow(_ bc: FamilyBroadcast) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Circle()
                .fill(colorForLabel(bc.resultLabel))
                .frame(width: 10, height: 10)
                .padding(.top, 6)
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(labelText(bc.resultLabel))
                        .font(.caption.weight(.bold))
                        .foregroundColor(colorForLabel(bc.resultLabel))
                    if bc.source == "auto_query" {
                        Text(languageCode == "en" ? "Auto" : "自动")
                            .font(.caption2.weight(.medium))
                            .padding(.horizontal, 6).padding(.vertical, 1)
                            .background(AppTheme.textSecondary.opacity(0.1))
                            .clipShape(Capsule())
                            .foregroundColor(AppTheme.textSecondary)
                    }
                    Spacer()
                    Text(timeAgo(bc.createdAt))
                        .font(.caption2)
                        .foregroundColor(AppTheme.textSecondary)
                }
                Text(bc.contentDisplay)
                    .font(.caption)
                    .foregroundColor(AppTheme.textPrimary)
                    .lineLimit(2)
            }
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 14)
    }

    private func colorForLabel(_ label: FamilyBroadcast.ResultLabel) -> Color {
        switch label {
        case .scam: return AppTheme.riskHigh
        case .safe: return AppTheme.riskLow
        case .unknown: return AppTheme.riskMedium
        }
    }

    private func labelText(_ label: FamilyBroadcast.ResultLabel) -> String {
        switch label {
        case .scam: return languageCode == "en" ? "Scam" : "诈骗"
        case .safe: return languageCode == "en" ? "Safe" : "安全"
        case .unknown: return languageCode == "en" ? "Unverified" : "未确认"
        }
    }

    private func timeAgo(_ iso: String?) -> String {
        guard let iso else { return "" }
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let d = f.date(from: iso) ?? {
            let f2 = ISO8601DateFormatter()
            f2.formatOptions = [.withInternetDateTime]
            return f2.date(from: iso)
        }()
        guard let date = d else { return "" }
        let dt = -date.timeIntervalSinceNow
        if dt < 60 { return languageCode == "en" ? "now" : "刚刚" }
        if dt < 3600 { return languageCode == "en" ? "\(Int(dt/60))m" : "\(Int(dt/60))分钟前" }
        if dt < 86400 { return languageCode == "en" ? "\(Int(dt/3600))h" : "\(Int(dt/3600))小时前" }
        return languageCode == "en" ? "\(Int(dt/86400))d" : "\(Int(dt/86400))天前"
    }

    private func loadBroadcasts() async {
        guard AuthInterceptor.token() != nil else { return }
        loadingBroadcasts = true
        defer { loadingBroadcasts = false }
        do {
            let list = try await FamilyRepository.shared.getBroadcasts(limit: 20)
            await MainActor.run {
                recentBroadcasts = list
                // 加载完成后重新计算"是否被关闭"
                // 若最新一条的 id 仍等于上次关闭时记录的 id → 保持隐藏；否则展示
                hideRecentBroadcasts = computeHideRecentBroadcasts()
            }
        } catch {
            #if DEBUG
            print("[FamilyGroupView] loadBroadcasts failed: \(error)")
            #endif
        }
    }

    // MARK: - Members

    private var memberSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(languageCode == "en" ? "Members" : "家庭成员")
                .font(.subheadline.weight(.semibold))
                .foregroundColor(AppTheme.textSecondary)
            VStack(spacing: 0) {
                ForEach(group.members) { member in
                    NavigationLink {
                        MemberDetailView(
                            vm: vm,
                            member: member,
                            groupId: group.id,
                            isCurrentUserOwnerOrGuardian: group.isOwner
                        )
                    } label: {
                        memberRow(member: member)
                    }
                    .buttonStyle(.plain)
                    if member.id != group.members.last?.id || canShowInviteRow {
                        Divider().padding(.leading, 60)
                    }
                }
                // owner & 未满 → 列表末尾加邀请家人占位行
                if canShowInviteRow {
                    Button {
                        showInviteSheet = true
                    } label: {
                        inviteRowLabel
                    }
                    .buttonStyle(.plain)
                }
            }
            .background(AppTheme.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.medium))
            if group.isFull {
                fullGroupHintRow
            }
        }
    }

    private var canShowInviteRow: Bool {
        // S5-12：任一成员都可邀请；只看是否满员
        !group.isFull
    }

    private var inviteRowLabel: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .strokeBorder(AppTheme.primary.opacity(0.4), style: StrokeStyle(lineWidth: 1.2, dash: [3, 2]))
                    .frame(width: 40, height: 40)
                Image(systemName: "plus")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(AppTheme.primary)
            }
            Text(languageCode == "en" ? "Invite family" : "邀请家人")
                .font(.subheadline.weight(.medium))
                .foregroundColor(AppTheme.primary)
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundColor(AppTheme.textSecondary)
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 14)
        .contentShape(Rectangle())  // 整行可点（包括 Spacer 透明区）
    }

    /// 当前登录用户的 user id（用于判定哪行是"我"）
    private var currentUserId: String? {
        UserSessionStore.shared.currentUser?.id
    }

    /// 家庭满员提示行：灰色文本 + "去升级 ›" 主色链接 → Premium 页
    /// Pro 用户已是 10 人上限，不显示升级入口（只显示文案）
    private var fullGroupHintRow: some View {
        let isPro = appState.subscriptionActive
        let text: String = languageCode == "en"
            ? "Group full (\(group.maxMembers)/\(group.maxMembers))."
            : "家庭组已满 (\(group.maxMembers)/\(group.maxMembers))。"
        return HStack(spacing: 4) {
            Text(text)
                .font(.caption)
                .foregroundColor(AppTheme.textSecondary)
            if !isPro {
                NavigationLink {
                    PremiumSubscriptionView()
                        .environmentObject(appState)
                        .mainTabBarHidden()
                } label: {
                    HStack(spacing: 2) {
                        Text(languageCode == "en" ? "Upgrade to expand to 10" : "去升级扩容至 10 人")
                        Image(systemName: "chevron.right")
                            .font(.caption2.weight(.semibold))
                    }
                    .font(.caption.weight(.semibold))
                    .foregroundColor(AppTheme.primary)
                }
                .buttonStyle(.plain)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 4)
    }

    /// 今日已广播次数（从 recentBroadcasts 数组里数 createdAt 是今日的条目）
    /// 免费配额 1/天；Pro 不限（显示 ∞）
    private var todayBroadcastText: String {
        let isPro = appState.subscriptionActive
        let cap = isPro ? "∞" : "1"
        let used = countTodayBroadcasts()
        if languageCode == "en" {
            return "Today \(used)/\(cap)"
        }
        return "今日 \(used)/\(cap) 次"
    }

    /// 统计 recentBroadcasts 数组里 createdAt 落在本地"今天" 的条目数
    private func countTodayBroadcasts() -> Int {
        let cal = Calendar.current
        let now = Date()
        return recentBroadcasts.reduce(0) { acc, bc in
            guard let s = bc.createdAt, let d = parseIsoDate(s) else { return acc }
            return cal.isDate(d, inSameDayAs: now) ? acc + 1 : acc
        }
    }

    private func parseIsoDate(_ s: String) -> Date? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: s) { return d }
        let f2 = ISO8601DateFormatter()
        f2.formatOptions = [.withInternetDateTime]
        return f2.date(from: s)
    }

    private func memberRow(member: FamilyMember) -> some View {
        let name = member.effectiveName(language: languageCode)
        let isSelf = (member.userId == currentUserId)
        return HStack(spacing: 12) {
            // 头像占位（首字按有效名字取）
            ZStack {
                Circle()
                    .fill(AppTheme.primary.opacity(0.2))
                    .frame(width: 40, height: 40)
                Text(String(name.prefix(1)))
                    .font(.headline)
                    .foregroundColor(AppTheme.primary)
            }
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    // S5-12 显示家庭内有效名字（私人备注 > 自我命名 > APP 昵称 > 手机后4位 > id后4位）
                    Text(name)
                        .font(.subheadline.weight(.medium))
                        .foregroundColor(AppTheme.textPrimary)
                    if member.role == .owner {
                        Text(languageCode == "en" ? "Owner" : "群主")
                            .font(.caption2.weight(.bold))
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(AppTheme.primary.opacity(0.12))
                            .foregroundColor(AppTheme.primary)
                            .clipShape(Capsule())
                    }
                    // #9：自己那行加"我"标注，与群主同样的 capsule 样式但用次要色
                    if isSelf {
                        Text(languageCode == "en" ? "Me" : "我")
                            .font(.caption2.weight(.bold))
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(AppTheme.riskLow.opacity(0.15))
                            .foregroundColor(AppTheme.riskLow)
                            .clipShape(Capsule())
                    }
                    if member.elderModeEnabled {
                        Text("👴").font(.caption)
                    }
                }
                Text("\(member.activityStatus.emoji) \(member.activityStatus.displayName)")
                    .font(.caption)
                    .foregroundColor(AppTheme.textSecondary)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundColor(AppTheme.textSecondary)
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 14)
        .contentShape(Rectangle())  // 整行可点（包括 Spacer 透明区）
    }

    // MARK: - 主 action：分享信息（柔和样式）

    private var shareAction: some View {
        Button { showShareSheet = true } label: {
            HStack(spacing: 8) {
                Image(systemName: "megaphone.fill")
                Text(languageCode == "en" ? "Share to Family" : "分享信息到家庭")
            }
            .font(.body.weight(.semibold))
            .foregroundColor(AppTheme.primary)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(AppTheme.primary.opacity(0.12))
            .overlay(
                // 加边框增强可见度，跟实心 fill 区分（柔和但可识别）
                RoundedRectangle(cornerRadius: AppTheme.CornerRadius.medium)
                    .strokeBorder(AppTheme.primary.opacity(0.45), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.medium))
        }
    }
}

// MARK: - 全部家庭消息列表（"查看全部" 入口）

private struct FamilyBroadcastListView: View {
    let broadcasts: [FamilyBroadcast]
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"

    var body: some View {
        List(broadcasts) { bc in
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 6) {
                    Circle()
                        .fill(colorForLabel(bc.resultLabel))
                        .frame(width: 8, height: 8)
                    Text(labelText(bc.resultLabel))
                        .font(.caption.weight(.bold))
                        .foregroundColor(colorForLabel(bc.resultLabel))
                    Spacer()
                    Text(bc.createdAt ?? "")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
                Text(bc.contentDisplay)
                    .font(.subheadline)
            }
            .padding(.vertical, 4)
        }
        .listStyle(.insetGrouped)
        .navigationTitle(languageCode == "en" ? "Family Messages" : "家庭消息")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func colorForLabel(_ label: FamilyBroadcast.ResultLabel) -> Color {
        switch label {
        case .scam: return AppTheme.riskHigh
        case .safe: return AppTheme.riskLow
        case .unknown: return AppTheme.riskMedium
        }
    }

    private func labelText(_ label: FamilyBroadcast.ResultLabel) -> String {
        switch label {
        case .scam: return languageCode == "en" ? "Scam" : "诈骗"
        case .safe: return languageCode == "en" ? "Safe" : "安全"
        case .unknown: return languageCode == "en" ? "Unverified" : "未确认"
        }
    }
}

// MARK: - 占位：隐私设置 sheet

/// 暂未独立实现完整隐私设置页（S6 再做），先用一个简易 sheet 占位
/// 内含：shareQueryResults 开关 + 说明文案
private struct FamilyPrivacySheet: View {
    @ObservedObject var vm: FamilyViewModel
    @Environment(\.dismiss) private var dismiss
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    @State private var shareQueryResults: Bool = true
    @State private var saving = false

    var body: some View {
        NavigationStack {
            Form {
                Section(footer: Text(languageCode == "en"
                                     ? "When OFF, your high-risk queries won't automatically broadcast as 'StarLens Official' to family. Manual share still works."
                                     : "关闭后，你查询的高风险结果不会自动以'StarLens 官方'名义广播给家人。你仍可手动分享信息。")) {
                    Toggle(isOn: $shareQueryResults) {
                        Text(languageCode == "en"
                             ? "Auto-broadcast my high-risk queries"
                             : "我的高风险查询自动广播")
                    }
                    .disabled(saving)
                    .onChange(of: shareQueryResults) { _, newValue in
                        saving = true
                        Task {
                            // TODO 调 vm.updatePreferences(shareQueryResults: newValue)
                            try? await Task.sleep(nanoseconds: 200_000_000)
                            await MainActor.run { saving = false }
                        }
                    }
                }
            }
            .navigationTitle(languageCode == "en" ? "Privacy" : "隐私设置")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(languageCode == "en" ? "Done" : "完成") { dismiss() }
                }
            }
        }
    }
}
