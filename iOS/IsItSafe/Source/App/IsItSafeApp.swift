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

    var body: some Scene {
        WindowGroup {
            Group {
                if appState.hasValidSession {
                    MainTabView()
                } else {
                    LoginView()
                }
            }
            .environmentObject(appState)
            .environmentObject(router)
            .sheet(isPresented: $router.isShowingLogin) {
                LoginView()
                    .environmentObject(appState)
                    .environmentObject(router)
            }
        }
    }
}
