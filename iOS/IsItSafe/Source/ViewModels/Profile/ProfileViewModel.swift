//
//  ProfileViewModel.swift
//  IsItSafe
//

import Combine
import Foundation
import SwiftUI

public final class ProfileViewModel: ObservableObject {
    @Published public var user: UserInfoResponse?
    @Published     public var subscriptionActive = false
    @Published public var hasUnreadMessages = false

    /// 是否会员（优先看实时订阅状态，其次看 userInfo 回传）
    public var isPremium: Bool { subscriptionActive || user?.subscriptionStatus == "premium" }

    /// 会员到期日，格式 YYYY-MM-DD，供 MemberEntryBanner 显示「有效期：2026-XX-XX」
    public var vipExpireDateText: String? {
        guard let raw = user?.subscriptionExpire, !raw.isEmpty else { return nil }
        let s = String(raw.prefix(10))
        return s.count == 10 ? s : raw
    }

    private let appState = AppStateViewModel.shared
    private let messageService = MessageService.shared
    private var cancellables = Set<AnyCancellable>()

    public init() {
        user = appState.user
        subscriptionActive = appState.subscriptionActive
        bindAppState()
    }

    public func refresh() {
        appState.refreshLoginState()
        user = appState.user
        subscriptionActive = appState.subscriptionActive
        Task {
            await appState.refreshSubscriptionState()
            await MainActor.run {
                self.subscriptionActive = self.appState.subscriptionActive
            }
        }
        refreshUnreadCount()
    }

    private func bindAppState() {
        appState.$user
            .receive(on: DispatchQueue.main)
            .sink { [weak self] newUser in
                self?.user = newUser
            }
            .store(in: &cancellables)

        appState.$subscriptionActive
            .receive(on: DispatchQueue.main)
            .sink { [weak self] active in
                self?.subscriptionActive = active
            }
            .store(in: &cancellables)

        appState.$hasUnreadMessages
            .receive(on: DispatchQueue.main)
            .sink { [weak self] hasUnread in
                self?.hasUnreadMessages = hasUnread
            }
            .store(in: &cancellables)
    }

    public func refreshUnreadCount() {
        guard appState.isLoggedIn else { hasUnreadMessages = false; appState.setHasUnreadMessages(false); return }
        Task {
            let count = await messageService.unreadCount()
            await MainActor.run {
                hasUnreadMessages = count > 0
                appState.setHasUnreadMessages(count > 0)
            }
        }
    }

    public func logout() {
        Task {
            try? await AuthService.shared.logout()
            await MainActor.run {
                appState.refreshLoginState()
                user = nil
                subscriptionActive = false
            }
        }
    }
}
