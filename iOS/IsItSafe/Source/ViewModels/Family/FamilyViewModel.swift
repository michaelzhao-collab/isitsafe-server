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

    /// S5-10 当前选中显示的家庭组 id（本地持久化，跨会话保留）
    /// 未选 / 选中 group 不在 allGroups 时 fallback 到第一个
    private let selectedGroupIdKey = "isitsafe.family.selectedGroupId"

    private let repo = FamilyRepository.shared
    private var refreshTask: Task<Void, Never>?

    public init() {}

    // MARK: - 加载

    /// 拉取所有家庭组（未登录 → notLoggedIn；未加入 → empty；已加入 → loaded 选中那个）
    public func refresh() {
        refreshTask?.cancel()
        refreshTask = Task { [weak self] in
            guard let self else { return }
            guard AuthInterceptor.token() != nil else {
                self.state = .notLoggedIn
                return
            }
            if !State.loaded(FamilyGroup.placeholder).isLoaded(matching: self.state) {
                self.state = .loading
            }
            do {
                let groups = try await self.repo.getMyGroups()
                self.allGroups = groups
                if groups.isEmpty {
                    self.state = .empty
                    // ChatMessageView 用此 key 决定是否显示"一键拨打家人"等按钮
                    UserDefaults.standard.removeObject(forKey: self.selectedGroupIdKey)
                    return
                }
                // 优先选 user 上次选中的；不在列表则 fallback 第一个（按 joinedAt 最早）
                let saved = UserDefaults.standard.string(forKey: self.selectedGroupIdKey) ?? ""
                let current = groups.first { $0.id == saved } ?? groups[0]
                UserDefaults.standard.set(current.id, forKey: self.selectedGroupIdKey)
                self.state = .loaded(current)
            } catch is CancellationError {
                // ignore
            } catch {
                self.state = .error(error.localizedDescription)
            }
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
            redeemError = "邀请码应为 6 位字符"
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
        let raw = error.localizedDescription
        // 常见后端错误关键词映射
        if raw.contains("Invalid invite code") || raw.contains("404") {
            return "邀请码无效，请确认后重试"
        }
        if raw.contains("expired") || raw.contains("Invite code expired") {
            return "邀请码已过期，请向家人重新获取"
        }
        if raw.contains("already in a family group") {
            return "你已经在一个家庭组里，无法再加入"
        }
        if raw.contains("Family group is full") || raw.contains("full") {
            return "对方家庭已满员，无法再加入"
        }
        if raw.contains("parental_consent_required") {
            return "未成年用户需先勾选监护人同意"
        }
        return "兑换失败：\(raw)"
    }

    // MARK: - 退出/解散

    public func leaveGroup(groupId: String) async -> Bool {
        inflightAction = "leave"
        defer { inflightAction = nil }
        do {
            try await repo.leaveGroup(groupId: groupId)
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
