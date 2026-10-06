//
//  IsItSafeApp.swift
//  IsItSafe
//
//  App 入口：环境、全局状态、主界面。
//

import Combine
import SwiftUI

@main
struct IsItSafeApp: App {
    // V3-S1-5：接 APNs 注册回调
    @UIApplicationDelegateAdaptor(PushAppDelegate.self) private var pushDelegate

    @StateObject private var appState = AppStateViewModel.shared
    @StateObject private var router = AppRouter.shared
    @AppStorage("app.fontScale") private var fontScale: Double = 1.0
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"

    init() {
        // 剪贴板邀请检测窗口起点：必须在登录前记录，才能区分「新装」与「老用户升级」
        InviteClipboardService.recordLaunch()
    }

    @State private var isSplashVisible = true
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            ZStack {
                Group {
                    if appState.hasValidSession {
                        MainTabView()
                    } else {
                        LoginView()
                    }
                }
                .environment(\.fontScale, fontScale)
                .environment(\.dynamicTypeSize, dynamicTypeSizeFromScale(fontScale))
                .environmentObject(appState)
                .environmentObject(router)
                .sheet(isPresented: $router.isShowingLogin) {
                    LoginView()
                        .environmentObject(appState)
                        .environmentObject(router)
                }
                .onAppear {
                    // 2026-09-27 复核：原来每次冷启动无条件按系统语言覆盖 languageCode，
                    // 把用户在 App 内手动选的语言冲掉。默认语言的初始化已由 AppSettingsStore.init
                    // 在「首次启动且未设置」时完成，这里不再覆盖。
                    // 启动时触发网络预热
                    Task { await AuthService.shared.refreshTokenIfNeeded() }
                    // V5：推送权限不在冷启动弹（首页首次出结果 / 进入情报 / 家庭 tab 时再弹），
                    //       避免一启动就被拒、开通率低。
                    //       但已授权用户仍需每次启动静默重注册，覆盖 APNs token 轮换（换机/恢复备份）。
                    PushService.shared.registerIfAuthorized()
                    // V5：开启 StoreKit Transaction 常驻监听：仍有效的重投交易补发后端 verify
                    //       （成功才 finish），过期/已撤销的清理掉，避免下次 purchase() 被旧
                    //       receipt 拽出来"卡死"。
                    IAPManager.shared.startTransactionMonitor()
                    // V5.1：登录态下自举家庭群聊（连 WS + 拉未读，保证家庭 Tab 角标可用）
                    FamilyChatCoordinator.shared.bootstrapIfLoggedIn()
                }
                .onChange(of: scenePhase) { _, phase in
                    switch phase {
                    case .active: FamilyChatCoordinator.shared.appDidBecomeActive()
                    case .background: FamilyChatCoordinator.shared.appDidEnterBackground()
                    default: break
                    }
                }
                // V3-E Universal Link：www.starlensai.com/i/{code} 拉起 App 直接进兑换流程
                .onOpenURL { url in
                    router.handleUniversalLink(url)
                }
                .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
                    if let url = activity.webpageURL {
                        router.handleUniversalLink(url)
                    }
                }

                if isSplashVisible {
                    SplashView()
                        .ignoresSafeArea()
                        .transition(.opacity)
                        .zIndex(999)
                }
            }
            .onAppear {
                Task {
                    try? await Task.sleep(nanoseconds: 1_200_000_000)
                    withAnimation(.easeOut(duration: 0.35)) {
                        isSplashVisible = false
                    }
                }
            }
        }
    }
}

/// 字号设置：仅放大/缩小字体，不改变布局（通过 Dynamic Type 影响使用语义字体的文案）
private func dynamicTypeSizeFromScale(_ scale: Double) -> DynamicTypeSize {
    if scale <= 0.9 { return .small }
    if scale >= 1.1 { return .large }
    return .medium
}
