//
//  AppStateViewModel.swift
//  IsItSafe
//

import Combine
import Foundation
import SwiftUI

public final class AppStateViewModel: ObservableObject {
    public static let shared = AppStateViewModel()
    @Published public private(set) var isLoggedIn = false
    @Published public private(set) var user: UserInfoResponse?
    @Published public private(set) var subscriptionActive = false
    @Published public private(set) var hasCompletedInitialLogin = false
    @Published public private(set) var hasUnreadMessages = false
    @Published public var isGuestMode = false {
        didSet { UserDefaults.standard.set(isGuestMode, forKey: Self.guestModeKey) }
    }
    @Published public var errorMessage: String?
    @Published public var showError = false
    @Published public var successMessage: String?
    @Published public var showSuccess = false

    private static let guestModeKey = "isitsafe.isGuestMode"
    private static let initialLoginKey = "isitsafe.hasCompletedInitialLogin"
    private let auth = AuthService.shared
    private let subscription = SubscriptionService.shared

    /// 有有效会话：必须完成一次登录流程后才可进入主界面
    public var hasValidSession: Bool { isLoggedIn && hasCompletedInitialLogin }

    private init() {
        isLoggedIn = auth.isLoggedIn
        user = auth.currentUser
        isGuestMode = false
        UserDefaults.standard.set(false, forKey: Self.guestModeKey)
        hasCompletedInitialLogin = UserDefaults.standard.bool(forKey: Self.initialLoginKey)
        // 并行预加载首屏所需数据（公开配置 + 订阅状态 + 未读消息），节省串行延迟
        // 原本是 fetchPublicConfig → sleep 500ms → refreshSubscriptionState，总耗时 ≥ 500ms + 两次 RTT
        // 改成并行后总耗时约为 max(各请求耗时)
        Task {
            async let config: Void = fetchPublicConfig()
            async let sub: Void = refreshSubscriptionState()
            async let unread: Void = refreshUnreadCount()
            _ = await (config, sub, unread)
        }
    }

    /// 拉取服务端公开配置（每日免费次数等），失败时沿用本地缓存或默认值
    private func fetchPublicConfig() async {
        struct PublicConfigResponse: Decodable {
            let freeQueriesPerDay: Int
        }
        do {
            let config: PublicConfigResponse = try await NetworkManager.shared.request(endpoint: .publicConfig)
            AppSettingsStore.maxFreeQueriesPerDay = config.freeQueriesPerDay
        } catch {
            // 失败静默处理，使用缓存值或默认 5
        }
    }

    public func refreshLoginState() {
        isLoggedIn = auth.isLoggedIn
        user = auth.currentUser
        if isLoggedIn {
            Task { await refreshUnreadCount() }
        } else {
            hasUnreadMessages = false
        }
    }

    public func setHasUnreadMessages(_ value: Bool) {
        hasUnreadMessages = value
    }

    public func refreshUnreadCount() async {
        guard auth.isLoggedIn else {
            await MainActor.run { hasUnreadMessages = false }
            return
        }
        let count = await MessageService.shared.unreadCount()
        await MainActor.run { hasUnreadMessages = count > 0 }
    }

    public func refreshSubscriptionState() async {
        guard auth.isLoggedIn else {
            subscriptionActive = false
            return
        }
        do {
            let status = try await subscription.fetchStatus()
            await MainActor.run {
                subscriptionActive = status.isPremium ?? status.active
            }
        } catch {
            await MainActor.run { subscriptionActive = false }
        }
    }

    public func setUser(_ u: UserInfoResponse?) {
        user = u
        isLoggedIn = u != nil
    }

    /// 在登录成功后调用：标记用户已完成一次正式登录
    public func markInitialLoginCompleted() {
        hasCompletedInitialLogin = true
        UserDefaults.standard.set(true, forKey: Self.initialLoginKey)
    }

    public func setSubscriptionActive(_ active: Bool) {
        subscriptionActive = active
    }

    /// 退出游客模式（登出时调用）
    public func exitGuestMode() {
        isGuestMode = false
    }

    public func showError(_ msg: String) {
        errorMessage = msg
        showError = true
    }

    public func clearError() {
        showError = false
        errorMessage = nil
    }

    public func showSuccess(_ msg: String) {
        successMessage = msg
        showSuccess = true
    }

    public func clearSuccess() {
        showSuccess = false
        successMessage = nil
    }
}
