//
//  FamilyViewModel.swift
//  IsItSafe
//
//  V3-E 家庭 Tab 主 ViewModel：负责加载家庭组状态 + 创建/邀请/兑换/退出流程
//

import Foundation
import Combine

@MainActor
public final class FamilyViewModel: ObservableObject {
    /// UI 状态机
    public enum State: Equatable {
        case loading
        case empty                       // 已登录但未加入家庭组
        case loaded(FamilyGroup)
        case error(String)
        case notLoggedIn

        public static func == (lhs: State, rhs: State) -> Bool {
            switch (lhs, rhs) {
            case (.loading, .loading),
                 (.empty, .empty),
                 (.notLoggedIn, .notLoggedIn): return true
            case (.loaded(let a), .loaded(let b)): return a.id == b.id
            case (.error(let a), .error(let b)): return a == b
            default: return false
            }
        }
    }

    @Published public var state: State = .loading

    /// 正在进行的异步操作（创建 / 兑换 / 邀请 ...），用于禁用按钮
    @Published public var inflightAction: String?

    /// 邀请码兑换的非阻塞错误（"邀请码无效 / 已过期 / 群满"等）
    /// 单独存储，不污染全局 state — 否则整个家庭 Tab 会变成"加载失败"页
    @Published public var redeemError: String?

    /// S5-10 多家庭：我加入的全部家庭组（含 owner / member）
    @Published public var allGroups: [FamilyGroup] = []

    /// 当前用户作为 owner 创建的家庭组数量（vs 加入别人家庭的数量）
    /// 服务端限制：免费 1 / Pro 3
    public var ownedGroupCount: Int { allGroups.filter(\.isOwner).count }

    /// 当前用户还能不能创建新家庭
    /// 业主反馈：加入别人家庭后右上角也要能创建（之前只在 FamilyEmptyView 入口能创建）
    public func canCreateMoreGroup(isPremium: Bool) -> Bool {
        let limit = isPremium ? 3 : 1
        return ownedGroupCount < limit
    }

    /// S5-10 当前选中显示的家庭组 id（本地持久化，跨会话保留）
    /// 未选 / 选中 group 不在 allGroups 时 fallback 到第一个
    private let selectedGroupIdKey = "isitsafe.family.selectedGroupId"

    private let repo = FamilyRepository.shared
    private var refreshTask: Task<Void, Never>?

    /// 2026-10-14 真机反馈：每次冷启动进家庭 Tab 都转圈「加载中」（VM 虽已提到 MainTabView，
    /// 但进程重启后仍从 .loading 起步，要等心跳 + 拉群两个请求回来，手机网络下 4 秒起）。
    /// 现在把上次拉到的家庭列表按用户 id 缓存到本地，启动时先用缓存渲染，再后台静默刷新。
    /// 缓存按用户 id 分 key；UserSessionStore.clearSession() 登出 / 删号 / 401 时按前缀整体清掉。
    /// 缓存时成员的完整手机号置空（SOS 拨号前会 refresh 拉新数据），避免全家号码明文落盘。
    static let groupsCachePrefix = "isitsafe.family.groupsCache."
    private var groupsCacheKey: String? {
        TokenStore.shared.userId.map { Self.groupsCachePrefix + $0 }
    }
    /// 当前 allGroups / state 属于哪个用户：401 失效后在弹层里换账号登录时 MainTabView 不会重建，
    /// 靠这个识别「数据不是本人的」并丢弃，不让新账号看到上一个账号的家庭。
    private var loadedUserId: String?

    /// - Parameter restoreCache: 长辈 SOS 页传 false —— 缓存里不存手机号，用缓存渲染会先显示「暂无可拨号码」
    public init(restoreCache: Bool = true) {
        if restoreCache { restoreFromCache() }
    }

    // MARK: - 加载

    /// 拉取所有家庭组（未登录 → notLoggedIn；未加入 → empty；已加入 → loaded 选中那个）
    public func refresh() {
        refreshTask?.cancel()
        refreshTask = Task { [weak self] in
            guard let self else { return }
            guard AuthInterceptor.token() != nil else {
                self.allGroups = []
                self.loadedUserId = nil
                self.state = .notLoggedIn
                return
            }
            let requestUserId = TokenStore.shared.userId
            // 内存里的数据不是当前登录者的（401 后在弹层换账号）→ 丢弃，不拿它当「已有数据」
            if self.loadedUserId != requestUserId {
                self.allGroups = []
                self.state = .loading
            }
            // .loaded / .empty 都是「已有确定结果」（缓存恢复或上次刷新），刷新期间保持原页面；
            // 只有 .loading / .error / .notLoggedIn 才显示「加载中」
            let hadLoadedData: Bool = {
                switch self.state {
                case .loaded, .empty: return true
                default: return false
                }
            }()
            if !hadLoadedData {
                self.state = .loading
            }
            do {
                let groups = try await self.repo.getMyGroups()
                // 等待期间换了账号 / 被新的 refresh 取代：结果作废，不能写进新账号的内存与缓存
                guard !Task.isCancelled, TokenStore.shared.userId == requestUserId else { return }
                self.allGroups = groups
                self.loadedUserId = TokenStore.shared.userId
                if groups.isEmpty {
                    self.state = .empty
                    // ChatMessageView 用此 key 决定是否显示"一键拨打家人"等按钮
                    UserDefaults.standard.removeObject(forKey: self.selectedGroupIdKey)
                    // 「没有家庭」也缓存：否则没家庭的用户每次冷启动都先转圈再出「创建 / 加入」页
                    self.persistCache([])
                    // 2026-10-14 真机：退群后 IM 协调器仍握着旧群 id，「发到家庭群」按钮以为还有家庭 → 发送失败
                    FamilyChatCoordinator.shared.setGroups([])
                    return
                }
                self.state = .loaded(self.selectCurrent(from: groups, persist: true))
                self.persistCache(groups)
            } catch {
                // refreshTask.cancel() 串联取消 URLSession → 抛出的 URLError.cancelled
                // 被 mapError 包成 APIError.networkError，模式匹配捕不到，
                // 改用 Task.isCancelled 一并兜住「swift Task 取消 + URLSession 取消」
                if Task.isCancelled { return }
                if error is CancellationError { return }
                // 401：ResponseValidator 已清 token 但不改 appState.isLoggedIn，这里必须自己落到未登录，
                // 否则页面停在旧群上，发消息 / 拉成员全失败却没有「请重新登录」提示
                if case APIError.unauthorized = error, AuthInterceptor.token() == nil {
                    self.allGroups = []
                    self.loadedUserId = nil
                    self.state = .notLoggedIn
                    return
                }
                // 已经有家庭在显示（缓存或上次刷新）时，静默刷新失败不把整页换成「加载失败」；
                // 显示的是「没有家庭」时仍落到 .error，保留重试入口（也许其实有家庭只是没拉到）
                if case .loaded = self.state { return }
                self.state = .error(error.localizedDescription)
            }
        }
    }

    /// 优先选用户上次选中的；不在列表则 fallback 第一个（按 joinedAt 最早）。
    /// persist=false 用于缓存恢复：推送 / 深链在 MainTabView 出现前写入的 selectedGroupId
    /// 可能指向缓存里还没有的新群，这时不能把它覆盖掉，留给 refresh() 拉到全量后再定。
    private func selectCurrent(from groups: [FamilyGroup], persist: Bool) -> FamilyGroup {
        let saved = UserDefaults.standard.string(forKey: selectedGroupIdKey) ?? ""
        let current = groups.first { $0.id == saved } ?? groups[0]
        if persist {
            UserDefaults.standard.set(current.id, forKey: selectedGroupIdKey)
        }
        return current
    }

    private func restoreFromCache() {
        guard AuthInterceptor.token() != nil, let key = groupsCacheKey,
              let data = UserDefaults.standard.data(forKey: key),
              let groups = try? JSONDecoder().decode([FamilyGroup].self, from: data),
              groups.allSatisfy({ !$0.id.isEmpty }) else { return }
        allGroups = groups
        loadedUserId = TokenStore.shared.userId
        // 缓存为空数组 = 上次确认过「不在任何家庭」→ 直接出创建 / 加入页，后台刷新再纠正
        state = groups.isEmpty ? .empty : .loaded(selectCurrent(from: groups, persist: false))
    }

    /// 空数组也会写入（表示「确认没有家庭」）。成员完整手机号不落盘。
    private func persistCache(_ groups: [FamilyGroup]) {
        guard let key = groupsCacheKey else { return }
        let stripped = groups.map { g in
            FamilyGroup(
                id: g.id, name: g.name, ownerUserId: g.ownerUserId, memberCount: g.memberCount,
                maxMembers: g.maxMembers, isOwner: g.isOwner, createdAt: g.createdAt,
                members: g.members.map { m in
                    FamilyMember(
                        id: m.id, userId: m.userId, role: m.role, nickname: m.nickname, avatar: m.avatar,
                        elderModeEnabled: m.elderModeEnabled, activityStatus: m.activityStatus,
                        joinedAt: m.joinedAt, phone: nil, phoneDisplay: m.phoneDisplay, emailHandle: m.emailHandle,
                        displayName: m.displayName, myAlias: m.myAlias, shareQueryResults: m.shareQueryResults
                    )
                }
            )
        }
        if let data = try? JSONEncoder().encode(stripped) {
            UserDefaults.standard.set(data, forKey: key)
        } else {
            UserDefaults.standard.removeObject(forKey: key)
        }
    }

    /// 退群 / 解散成功后立刻把该群从内存与缓存里剔除：紧接着的 refresh() 若失败，
    /// 下次冷启动不会先渲染一个已经不在的家庭并对它启动 IM
    /// 同时把页面直接切到下一个状态（.empty 或剩余家庭），不再经过「加载中」。
    private func dropGroupLocally(_ groupId: String) {
        allGroups.removeAll { $0.id == groupId }
        persistCache(allGroups)
        FamilyChatCoordinator.shared.setGroups(allGroups.map(\.id))
        if allGroups.isEmpty {
            UserDefaults.standard.removeObject(forKey: selectedGroupIdKey)
            state = .empty
        } else {
            state = .loaded(selectCurrent(from: allGroups, persist: true))
        }
    }

    /// 登出 / 删号 / 401 公共出口调用：清掉所有账号的家庭缓存（含成员昵称、备注）
    public static func clearAllCaches() {
        let defaults = UserDefaults.standard
        for key in defaults.dictionaryRepresentation().keys where key.hasPrefix(groupsCachePrefix) {
            defaults.removeObject(forKey: key)
        }
    }

    /// 切换到指定家庭组（多家庭场景下用户从顶部切换器选）
    public func switchTo(groupId: String) {
        guard let g = allGroups.first(where: { $0.id == groupId }) else { return }
        UserDefaults.standard.set(groupId, forKey: selectedGroupIdKey)
        state = .loaded(g)
    }

    // MARK: - 创建

    public func createGroup(name: String?) async -> Bool {
        inflightAction = "create"
        defer { inflightAction = nil }
        do {
            let resp = try await repo.createGroup(name: name)
            // S5-10：新建后自动切到该家庭
            UserDefaults.standard.set(resp.id, forKey: selectedGroupIdKey)
            refresh()
            return true
        } catch {
            // 失败不污染 state（用户当前家庭仍可用）；用 redeemError 复用作通用错误显示
            redeemError = friendlyMessage(for: error)
            return false
        }
    }

    // MARK: - 兑换邀请码

    public func redeemInvite(code: String, parentConsent: Bool? = nil) async -> Bool {
        redeemError = nil
        let trimmed = code.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        guard trimmed.count == 6 else {
            redeemError = L10n.tr(zh: "邀请码应为 6 位字符", en: "The invite code must be 6 characters")
            return false
        }
        inflightAction = "redeem"
        defer { inflightAction = nil }
        do {
            let resp = try await repo.redeemInvite(code: trimmed, parentConsent: parentConsent)
            // S5-10：兑换成功后自动切到新加入的家庭
            UserDefaults.standard.set(resp.groupId, forKey: selectedGroupIdKey)
            refresh()
            return true
        } catch {
            // P0-4：失败仅在 sheet 内显示错误，不让整个 Tab 进 .error 状态
            redeemError = friendlyMessage(for: error)
            return false
        }
    }

    /// 把后端错误码翻译成长辈也能看懂的中文
    private func friendlyMessage(for error: Error) -> String {
        // 登录过期等非兑换类错误直接用通用文案（英文 "Your session has expired" 含 expired，会被误判成邀请码过期）
        if let api = error as? APIError, case .unauthorized = api { return api.userMessage }
        let raw = error.localizedDescription
        // 常见后端错误关键词映射
        if raw.contains("Invalid invite code") || raw.contains("404") {
            return L10n.tr(zh: "邀请码无效，请确认后重试", en: "Invalid invite code. Please check and try again.")
        }
        if raw.contains("Invite code expired") || raw.contains("invite code has expired") || raw.contains("邀请码已过期") || (raw.contains("expired") && raw.lowercased().contains("invite")) {
            return L10n.tr(zh: "邀请码已过期，请向家人重新获取", en: "This invite code has expired. Please ask your family for a new one.")
        }
        if raw.contains("already in a family group") || raw.contains("already a member") {
            return L10n.tr(zh: "你已经在一个家庭组里，无法再加入", en: "You are already in a family group and can't join another.")
        }
        if raw.contains("Family group is full") || raw.contains("full") {
            return L10n.tr(zh: "对方家庭已满员，无法再加入", en: "This family group is full.")
        }
        if raw.contains("parental_consent_required") {
            return L10n.tr(zh: "未成年用户需先勾选监护人同意", en: "Users under 13 need to confirm parental consent first.")
        }
        return L10n.tr(zh: "兑换失败：", en: "Couldn't join: ") + raw
    }

    // MARK: - 退出/解散

    public func leaveGroup(groupId: String) async -> Bool {
        inflightAction = "leave"
        defer { inflightAction = nil }
        do {
            try await repo.leaveGroup(groupId: groupId)
            // V4 业主诉求：退出后页面内容立刻重置。2026-10-14：不再经过「加载中」，
            // dropGroupLocally 直接切到 .empty 或剩余家庭，refresh() 再后台校正
            dropGroupLocally(groupId)
            refresh()
            return true
        } catch {
            state = .error(error.localizedDescription)
            return false
        }
    }

    public func dissolveGroup(groupId: String) async -> Bool {
        inflightAction = "dissolve"
        defer { inflightAction = nil }
        do {
            try await repo.dissolveGroup(groupId: groupId)
            // V4 业主诉求：解散后页面内容立刻重置（同上，不经过「加载中」）
            // FamilyView 自动卸下 FamilyGroupView，避免短暂残留"已解散家庭"的渲染
            dropGroupLocally(groupId)
            refresh()
            return true
        } catch {
            state = .error(error.localizedDescription)
            return false
        }
    }

    /// S5-12 改自己在该家庭组里的家庭内称呼
    public func setMyDisplayName(in groupId: String, name: String?) async -> Bool {
        do {
            try await repo.setMyDisplayName(groupId: groupId, displayName: name)
            refresh()
            return true
        } catch {
            redeemError = friendlyMessage(for: error)
            return false
        }
    }

    /// V5.1 群主移除成员
    public func removeMember(groupId: String, userId: String) async -> Bool {
        do {
            try await repo.removeMember(groupId: groupId, userId: userId)
            refresh()
            return true
        } catch {
            redeemError = friendlyMessage(for: error)
            return false
        }
    }

    /// V5.1 更新"分享我的查询结果"（自动播报开关）
    /// 2026-09-07 复核：必须带 groupId，否则服务端会把用户所有家庭的开关一起改掉。
    public func setShareQueryResults(_ enabled: Bool, groupId: String? = nil) async -> Bool {
        do {
            try await repo.updatePreferences(groupId: groupId, shareQueryResults: enabled)
            return true
        } catch {
            redeemError = friendlyMessage(for: error)
            return false
        }
    }

    /// 2026-10-14 群主改家庭群名称
    public func renameGroup(_ groupId: String, name: String) async -> Bool {
        do {
            try await repo.renameGroup(groupId: groupId, name: name)
            refresh()
            return true
        } catch {
            // 改名错误直接用服务端（已按语言翻译）的文案，不走邀请码兑换的错误映射（会变成「兑换失败：…」）
            redeemError = (error as? APIError)?.userMessage ?? error.localizedDescription
            return false
        }
    }

    /// V5.1 群昵称方案 B：群主给任意成员设群昵称（全员可见）
    public func setMemberDisplayNameByOwner(in groupId: String, memberId: String, name: String?) async -> Bool {
        do {
            try await repo.setMemberDisplayNameByOwner(groupId: groupId, memberId: memberId, displayName: name)
            refresh()
            return true
        } catch {
            redeemError = friendlyMessage(for: error)
            return false
        }
    }

    /// S5-12 给某成员设私人备注（仅自己可见）；alias=nil 删除
    public func setAlias(for memberId: String, alias: String?) async -> Bool {
        do {
            try await repo.setAlias(memberId: memberId, alias: alias)
            refresh()
            return true
        } catch {
            redeemError = friendlyMessage(for: error)
            return false
        }
    }

    /// S4-3 监护人远程开关被监护人长辈模式（owner / guardian 可用）
    /// 成功后自动刷新家庭组以反映新的 elderModeEnabled 状态
    public func setMemberElderMode(userId: String, enabled: Bool) async -> Bool {
        inflightAction = "elder_mode_\(userId)"
        defer { inflightAction = nil }
        do {
            try await repo.setMemberElderMode(userId: userId, enabled: enabled)
            refresh()
            return true
        } catch {
            state = .error(error.localizedDescription)
            return false
        }
    }

    // MARK: - V4-P3 关怀提醒静音

    /// 拉取我在该家庭组里静音了哪些 targetUserId（业主反馈：对方一直不活跃会一直发 push）
    public func listCareMutedTargets(groupId: String) async -> [String] {
        do {
            return try await repo.listCareMutedTargets(groupId: groupId)
        } catch {
            // 失败静默；UI 默认 unmuted 渲染即可（最坏情况收到 push 而已）
            return []
        }
    }

    /// 切换对某 target 的不活跃 push 静音；不刷新整个 group（避免抖动）
    public func setCareMute(groupId: String, targetUserId: String, muted: Bool) async -> Bool {
        do {
            try await repo.setCareMute(groupId: groupId, targetUserId: targetUserId, muted: muted)
            return true
        } catch {
            return false
        }
    }

    // MARK: - 生成邀请码

    public func generateInvite(groupId: String) async -> GenerateInviteResponse? {
        inflightAction = "invite"
        defer { inflightAction = nil }
        do {
            return try await repo.generateInvite(groupId: groupId)
        } catch {
            state = .error(error.localizedDescription)
            return nil
        }
    }

    // MARK: - 主动分享触发官方广播

    /// 主动分享一条信息（AI 检测后按结果以官方名义广播）
    public func createBroadcast(contentType: String, content: String) async -> BroadcastResponse? {
        let text = content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return nil }
        inflightAction = "broadcast"
        defer { inflightAction = nil }
        do {
            let resp = try await repo.createBroadcast(contentType: contentType, content: text)
            return resp
        } catch {
            state = .error(error.localizedDescription)
            return nil
        }
    }
}

// MARK: - 内部工具
private extension FamilyGroup {
    /// 占位符，用于状态比较时不引用真实数据
    static var placeholder: FamilyGroup {
        FamilyGroup(
            id: "", name: nil, ownerUserId: "",
            memberCount: 0, maxMembers: 5, isOwner: false,
            createdAt: nil, members: []
        )
    }
}

private extension FamilyViewModel.State {
    /// loading 状态时不重复设为 loading，避免 UI 闪烁
    func isLoaded(matching current: FamilyViewModel.State) -> Bool {
        if case .loaded = current { return true }
        return false
    }
}
