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
    @StateObject private var appState = AppStateViewModel.shared
    @StateObject private var router = AppRouter.shared
    @AppStorage("app.fontScale") private var fontScale: Double = 1.0
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"

    @State private var isSplashVisible = true

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
                    // 每次启动按系统语言同步：中文系统 -> zh；其他 -> en
                    let preferred = Locale.preferredLanguages.first?.lowercased() ?? "en"
                    languageCode = preferred.hasPrefix("zh") ? "zh" : "en"
                    // 启动时触发网络预热
                    Task { await AuthService.shared.refreshTokenIfNeeded() }
                }
                // V3-E Universal Link：starlens.ai/i/{code} 拉起 App 直接进兑换流程
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
