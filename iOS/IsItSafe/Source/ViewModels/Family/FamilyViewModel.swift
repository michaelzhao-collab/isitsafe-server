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

    private let repo = FamilyRepository.shared
    private var refreshTask: Task<Void, Never>?

    public init() {}

    // MARK: - 加载

    /// 拉取我的家庭组（未登录 → notLoggedIn；未加入 → empty；已加入 → loaded）
    public func refresh() {
        refreshTask?.cancel()
        refreshTask = Task { [weak self] in
            guard let self else { return }
            // 未登录直接 short-circuit
            guard AuthInterceptor.token() != nil else {
                self.state = .notLoggedIn
                return
            }
            if !State.loaded(FamilyGroup.placeholder).isLoaded(matching: self.state) {
                self.state = .loading
            }
            do {
                if let group = try await self.repo.getMyGroup() {
                    self.state = .loaded(group)
                } else {
                    self.state = .empty
                }
            } catch is CancellationError {
                // ignore
            } catch {
                self.state = .error(error.localizedDescription)
            }
        }
    }

    // MARK: - 创建

    public func createGroup(name: String?) async -> Bool {
        inflightAction = "create"
        defer { inflightAction = nil }
        do {
            _ = try await repo.createGroup(name: name)
            refresh()
            return true
        } catch {
            state = .error(error.localizedDescription)
            return false
        }
    }

    // MARK: - 兑换邀请码

    public func redeemInvite(code: String, parentConsent: Bool? = nil) async -> Bool {
        let trimmed = code.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        guard trimmed.count == 6 else {
            state = .error("邀请码应为 6 位字符")
            return false
        }
        inflightAction = "redeem"
        defer { inflightAction = nil }
        do {
            _ = try await repo.redeemInvite(code: trimmed, parentConsent: parentConsent)
            refresh()
            return true
        } catch {
            state = .error(error.localizedDescription)
            return false
        }
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
