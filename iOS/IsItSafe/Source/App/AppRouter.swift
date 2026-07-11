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

    // V3-E Universal Link 跳转：从 www.starlensai.com/i/{code} 拉起 App 后，主界面观察此值自动弹兑换 sheet
    @Published public var pendingInviteCode: String?
    // 拉起家庭 Tab 的指令（来自 push 通知或 deep link）
    @Published public var pendingTabIndex: Int?
    // V5.1 群聊「查一查是不是骗局」：携带待分析文本切到问助手 Tab，由首页消费
    @Published public var pendingAssistantText: String?

    private init() {}

    /// 从家庭群把一条消息转到问助手分析
    public func analyzeInAssistant(_ text: String) {
        pendingAssistantText = text
        pendingTabIndex = 0
    }

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
    /// - https://www.starlensai.com/i/{code} → 设置 pendingInviteCode + 跳家庭 Tab
    /// - 其他 → 忽略
    public func handleUniversalLink(_ url: URL) {
        guard let host = url.host?.lowercased() else { return }
        // 兼容旧域名 starlens.ai（改域名前 7 天 TTL 内发出的邀请链接仍需能拉起兑换）
        let allowed = ["starlensai.com", "starlens.ai"]
        guard allowed.contains(host) || allowed.contains(where: { host.hasSuffix(".\($0)") }) else { return }

        let parts = url.pathComponents.filter { $0 != "/" }
        if parts.count == 2, parts[0] == "i" {
            let code = parts[1].uppercased()
            pendingInviteCode = code
            pendingTabIndex = 2 // 家庭 Tab
        }
    }
}
