//
//  MainTabView.swift
//  IsItSafe
//

import Combine
import SwiftUI

public struct MainTabView: View {
    @State private var selectedTab = 0
    @EnvironmentObject private var appState: AppStateViewModel
    @EnvironmentObject private var router: AppRouter

    public init() {}

    public var body: some View {
        ZStack(alignment: .bottom) {
            Group {
                switch selectedTab {
                case 0:
                    HomeContainerView()
                case 1:
                    KnowledgeView()
                case 2:
                    ProfileView()
                default:
                    HomeContainerView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            // 底导：贴边、正常高度、背景与主页面区分
            tabBar
        }
        .ignoresSafeArea(.keyboard)
        .overlay(alignment: .center) {
            if appState.showError, let msg = appState.errorMessage {
                ToastView(message: msg, onDismiss: { appState.clearError() })
                    .transition(.opacity)
                    .zIndex(1)
            }
        }
    }

    private var tabBar: some View {
        HStack(spacing: 0) {
            tabItem(index: 0, icon: "bubble.left.and.text.bubble.right", title: "问助手")
            tabItem(index: 1, icon: "book.closed", title: "防诈案例")
            tabItem(index: 2, icon: "person", title: "我的")
        }
        .padding(.top, 6)
        .padding(.bottom, 12)
        .frame(maxWidth: .infinity)
        .background(AppTheme.tabBarBackground)
        .ignoresSafeArea(edges: .bottom)
    }

    private func tabItem(index: Int, icon: String, title: String) -> some View {
        Button {
            selectedTab = index
        } label: {
            VStack(spacing: 2) {
                Image(systemName: icon)
                    .font(.system(size: 20, weight: .medium))
                Text(title)
                    .font(.system(size: 10, weight: .medium))
            }
            .frame(maxWidth: .infinity)
            .foregroundColor(selectedTab == index ? AppTheme.primary : AppTheme.tabInactive)
        }
        .buttonStyle(.plain)
    }
}
