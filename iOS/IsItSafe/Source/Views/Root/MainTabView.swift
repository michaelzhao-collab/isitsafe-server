//
//  MainTabView.swift
//  IsItSafe
//

import Combine
import SwiftUI

public struct MainTabView: View {
    @State private var selectedTab = 0
    @StateObject private var homeVm = HomeViewModel()
    @StateObject private var historyVm = HistoryViewModel()
    @EnvironmentObject private var appState: AppStateViewModel
    @EnvironmentObject private var router: AppRouter
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    @StateObject private var tabBarVisibility = TabBarVisibility.shared

    public init() {}

    public var body: some View {
        ZStack(alignment: .bottom) {
            Group {
                switch selectedTab {
                case 0:
                    HomeContainerView(homeVm: homeVm, historyVm: historyVm)
                case 1:
                    KnowledgeView()
                case 2:
                    FamilyView()
                case 3:
                    ProfileView()
                default:
                    HomeContainerView(homeVm: homeVm, historyVm: historyVm)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .animation(.none, value: selectedTab)

            // 底导：贴边、正常高度、背景与主页面区分
            if !tabBarVisibility.isHidden {
                tabBar
            }
        }
        .ignoresSafeArea(.keyboard)
        .overlay(alignment: .center) {
            if appState.showError, let msg = appState.errorMessage {
                ToastView(message: msg, onDismiss: { appState.clearError() })
                    .transition(.opacity)
                    .zIndex(1)
            }
            if appState.showSuccess, let msg = appState.successMessage {
                ToastView(message: msg, isSuccess: true, onDismiss: { appState.clearSuccess() })
                    .transition(.opacity)
                    .zIndex(1)
            }
        }
        // V3-E Universal Link 跳转：router 设置 pendingTabIndex 时自动切 Tab
        .onChange(of: router.pendingTabIndex) { _, newIdx in
            if let idx = newIdx, idx >= 0 && idx <= 3 {
                selectedTab = idx
                router.pendingTabIndex = nil
            }
        }
    }

    private var tabBar: some View {
        HStack(spacing: 0) {
            tabItem(index: 0, icon: "bubble.left.and.text.bubble.right", title: languageCode == "en" ? "Assistant" : "问助手")
            tabItem(index: 1, icon: "book.closed", title: languageCode == "en" ? "Cases" : "防诈案例")
            tabItem(index: 2, icon: "person.2.fill", title: languageCode == "en" ? "Family" : "家庭")
            tabItem(index: 3, icon: "person", title: languageCode == "en" ? "Profile" : "我的")
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
            let isSelected = selectedTab == index
            VStack(spacing: 4) {
                ZStack(alignment: .topTrailing) {
                    Image(systemName: icon)
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundColor(isSelected ? .white : AppTheme.tabInactive)
                        .frame(width: 32, height: 32)
                        .background(
                            Group {
                                if isSelected {
                                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                                        .fill(AppTheme.primary)
                                } else {
                                    Color.clear
                                }
                            }
                        )
                    if index == 3, appState.hasUnreadMessages {
                        Circle()
                            .fill(Color.red)
                            .frame(width: 8, height: 8)
                            .offset(x: 8, y: -6)
                    }
                }
                Text(title)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(isSelected ? AppTheme.primary : AppTheme.tabInactive)
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
    }
}
