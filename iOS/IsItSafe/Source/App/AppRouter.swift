//
//  AppRouter.swift
//  IsItSafe
//
//  全局路由：弹窗、全屏、Tab 切换等（当前以简单导航为主，后续可扩展）。
//

import Combine
import SwiftUI

public enum AppRoute: Hashable {
    case mainTabs
    case login
    case historyDetail(id: String)
    case knowledgeDetail(id: String)
    case subscription
    case settings
}

public final class AppRouter: ObservableObject {
    public static let shared = AppRouter()

    @Published public var path = NavigationPath()
    @Published public var presentedSheet: AppRoute?
    @Published public var isShowingLogin = false

    // V3-E Universal Link 跳转：从 starlens.ai/i/{code} 拉起 App 后，主界面观察此值自动弹兑换 sheet
    @Published public var pendingInviteCode: String?
    // 拉起家庭 Tab 的指令（来自 push 通知或 deep link）
    @Published public var pendingTabIndex: Int?

    private init() {}

    public func push(_ route: AppRoute) {
        path.append(route)
    }

    public func presentSheet(_ route: AppRoute) {
        presentedSheet = route
    }

    public func dismissSheet() {
        presentedSheet = nil
    }

    public func popToRoot() {
        path = NavigationPath()
    }

    public func showLogin() {
        isShowingLogin = true
    }

    public func dismissLogin() {
        isShowingLogin = false
    }

    // MARK: - Universal Link 解析

    /// 解析进入的 URL：
    /// - https://starlens.ai/i/{code} → 设置 pendingInviteCode + 跳家庭 Tab
    /// - 其他 → 忽略
    public func handleUniversalLink(_ url: URL) {
        guard let host = url.host?.lowercased() else { return }
        guard host == "starlens.ai" || host.hasSuffix(".starlens.ai") else { return }

        let parts = url.pathComponents.filter { $0 != "/" }
        if parts.count == 2, parts[0] == "i" {
            let code = parts[1].uppercased()
            pendingInviteCode = code
            pendingTabIndex = 2 // 家庭 Tab
        }
    }
}
