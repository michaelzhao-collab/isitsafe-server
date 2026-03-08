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

    /// 是否会员（以服务端 subscriptionStatus 为准）
    public var isPremium: Bool { user?.subscriptionStatus == "premium" }

    private let appState = AppStateViewModel.shared
    private let messageService = MessageService.shared

    public init() {
        user = appState.user
        subscriptionActive = appState.subscriptionActive
    }

    public func refresh() {
        appState.refreshLoginState()
        user = appState.user
        subscriptionActive = appState.subscriptionActive
        Task { await appState.refreshSubscriptionState() }
        subscriptionActive = appState.subscriptionActive
        refreshUnreadCount()
    }

    public func refreshUnreadCount() {
        guard appState.isLoggedIn else { hasUnreadMessages = false; return }
        Task {
            let count = await messageService.unreadCount()
            await MainActor.run { hasUnreadMessages = count > 0 }
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
