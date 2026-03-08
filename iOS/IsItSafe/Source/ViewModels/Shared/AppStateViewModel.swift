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
    @Published public var isGuestMode = false {
        didSet { UserDefaults.standard.set(isGuestMode, forKey: Self.guestModeKey) }
    }
    @Published public var errorMessage: String?
    @Published public var showError = false

    private static let guestModeKey = "isitsafe.isGuestMode"
    private let auth = AuthService.shared
    private let subscription = SubscriptionService.shared

    /// 有有效会话：已登录或游客模式，可进入主界面
    public var hasValidSession: Bool { isLoggedIn || isGuestMode }

    private init() {
        isLoggedIn = auth.isLoggedIn
        user = auth.currentUser
        isGuestMode = UserDefaults.standard.bool(forKey: Self.guestModeKey)
        Task { await refreshSubscriptionState() }
    }

    public func refreshLoginState() {
        isLoggedIn = auth.isLoggedIn
        user = auth.currentUser
    }

    public func refreshSubscriptionState() async {
        guard auth.isLoggedIn else {
            subscriptionActive = false
            return
        }
        do {
            let status = try await subscription.fetchStatus()
            await MainActor.run { subscriptionActive = status.active }
        } catch {
            await MainActor.run { subscriptionActive = false }
        }
    }

    public func setUser(_ u: UserInfoResponse?) {
        user = u
        isLoggedIn = u != nil
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
}
