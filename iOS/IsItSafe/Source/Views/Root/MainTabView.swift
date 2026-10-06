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
    @StateObject private var elderMode = ElderModeService.shared
    @ObservedObject private var familyChat = FamilyChatCoordinator.shared
    @ObservedObject private var inviteClipboard = InviteClipboardService.shared

    public init() {}

    public var body: some View {
        ZStack(alignment: .bottom) {
            // 长辈模式：仅"问助手" Tab 替换为 ElderHomeView，
            // 其余 Tab 走原页面但全局字号放大（其他页面所有字放大）
            elderAwareContent
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .animation(.none, value: selectedTab)

            // 底导：长辈模式也保留（用户能切到"我的"再关掉长辈模式）
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
            applyPendingTab(newIdx)
        }
        // 2026-09-27 复核：冷启动经邀请链接/推送进入时，pendingTabIndex 在 MainTabView 出现前
        // 已被设好，onChange 不会对初始值触发 → 永远停在 Tab 0。这里出现时消费一次。
        .onAppear {
            applyPendingTab(router.pendingTabIndex)
            inviteClipboard.checkIfNeeded()
        }
        // 2026-10-06 剪贴板延迟绑定：在 MainTabView 而非首页挂载，长辈模式（ElderHomeView）也能生效
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.didBecomeActiveNotification)) { _ in
            inviteClipboard.checkIfNeeded()
        }
        .alert(
            languageCode == "en" ? "Family invitation" : "家庭邀请",
            isPresented: Binding(
                get: { inviteClipboard.detectedCode != nil },
                set: { if !$0 { inviteClipboard.finish() } }
            ),
            presenting: inviteClipboard.detectedCode
        ) { code in
            Button(languageCode == "en" ? "Join" : "加入") {
                inviteClipboard.finish()
                router.pendingInviteCode = code
                router.pendingInviteAutoJoin = true
                router.pendingTabIndex = 2
            }
            Button(languageCode == "en" ? "Cancel" : "取消", role: .cancel) {
                inviteClipboard.finish()
            }
        } message: { code in
            Text(languageCode == "en"
                 ? "Found a family invite code \(code) on your clipboard. Join this family group?\nBy joining you confirm you are at least 13, or have a parent/guardian's consent."
                 : "检测到家庭邀请码 \(code)，是否加入该家庭？\n加入即表示你已年满 13 岁，或已获得监护人同意。")
        }
    }

    private func applyPendingTab(_ idx: Int?) {
        if let idx, idx >= 0 && idx <= 3 {
            selectedTab = idx
            router.pendingTabIndex = nil
        }
    }

    /// 长辈模式下：
    ///   - Tab 0 (问助手) 替换为 ElderHomeView（已是大字大按钮设计）
    ///   - Tab 1/2/3 走原页面，但额外应用 `.dynamicTypeSize(.xLarge)` 字号统一放大
    /// 普通模式下：4 个 Tab 各自页面，沿用用户在"设置 → 字号"的全局 fontScale
    @ViewBuilder
    private var elderAwareContent: some View {
        if elderMode.isEnabled {
            switch selectedTab {
            case 0:
                ElderHomeView()
            case 1:
                IntelCaseRootView().dynamicTypeSize(.xLarge)
            case 2:
                FamilyView().dynamicTypeSize(.xLarge)
            case 3:
                ProfileView().dynamicTypeSize(.xLarge)
            default:
                ElderHomeView()
            }
        } else {
            switch selectedTab {
            case 0:
                HomeContainerView(homeVm: homeVm, historyVm: historyVm)
            case 1:
                IntelCaseRootView()
            case 2:
                FamilyView()
            case 3:
                ProfileView()
            default:
                HomeContainerView(homeVm: homeVm, historyVm: historyVm)
            }
        }
    }

    private var tabBar: some View {
        HStack(spacing: 0) {
            tabItem(index: 0, icon: "bubble.left.and.text.bubble.right", title: languageCode == "en" ? "Assistant" : "问助手")
            tabItem(index: 1, icon: "newspaper", title: languageCode == "en" ? "Intel" : "情报案例")
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
                    // V5.1 家庭群未读角标（全部家庭之和）
                    if index == 2, familyChat.totalUnread > 0 {
                        Text(familyChat.totalUnread > 99 ? "99+" : "\(familyChat.totalUnread)")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundColor(.white)
                            .padding(.horizontal, 4).padding(.vertical, 1)
                            .background(Capsule().fill(Color.red))
                            .offset(x: 12, y: -8)
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
