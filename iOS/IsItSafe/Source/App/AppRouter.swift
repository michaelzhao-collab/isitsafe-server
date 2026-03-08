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
}
