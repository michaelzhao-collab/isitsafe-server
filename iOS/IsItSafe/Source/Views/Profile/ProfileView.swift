//
//  ProfileView.swift
//  IsItSafe
//
//  我的页面：头像+昵称、会员入口、消息中心、任务中心、系统设置。
//

import SwiftUI

public struct ProfileView: View {
    @StateObject private var vm = ProfileViewModel()
    @State private var showSettings = false
    @State private var showProfileEdit = false
    @State private var showMessageCenter = false
    @EnvironmentObject private var appState: AppStateViewModel
    @EnvironmentObject private var router: AppRouter

    public init() {}

    public var body: some View {
        NavigationStack {
            List {
                if appState.isLoggedIn {
                    // 仅头像 + 昵称（点击进入个人资料修改）
                    Section {
                        Button {
                            showProfileEdit = true
                        } label: {
                            HStack(spacing: 16) {
                                profileAvatar
                                Text(displayName)
                                    .font(.headline)
                                    .foregroundColor(.primary)
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .font(.caption)
                                    .foregroundColor(AppTheme.secondaryText)
                            }
                            .padding(.vertical, 8)
                        }
                        .buttonStyle(.plain)
                    }

                    // 会员入口：banner 样式，与下方菜单左右对齐，上下边距减半
                    Section {
                        MemberEntryBanner(isMember: vm.isPremium)
                            .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
                            .listRowBackground(Color.clear)
                    }

                    // 两个入口：非会员页 / 会员页，便于分别查看
                    Section {
                        NavigationLink {
                            PremiumSubscriptionView()
                        } label: {
                            HStack(spacing: 12) {
                                Image(systemName: "crown")
                                    .foregroundColor(AppTheme.primary)
                                    .frame(width: 24, alignment: .center)
                                Text("开通会员")
                                    .foregroundColor(.primary)
                            }
                        }
                        NavigationLink {
                            MemberCenterView()
                        } label: {
                            HStack(spacing: 12) {
                                Image(systemName: "crown.fill")
                                    .foregroundColor(.yellow)
                                    .frame(width: 24, alignment: .center)
                                Text("会员中心")
                                    .foregroundColor(.primary)
                            }
                        }
                    }

                    Section {
                        messageCenterRow(showRedDot: vm.hasUnreadMessages) {
                            showMessageCenter = true
                        }
                        row(icon: "person.2", title: "任务中心") { }
                        row(icon: "gearshape", title: "系统设置") { showSettings = true }
                    }
                }

                Section {
                    if !appState.isLoggedIn {
                        Button("登录") {
                            router.showLogin()
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .background(AppTheme.background)
            .navigationTitle("我的")
            .onAppear { vm.refresh() }
            .sheet(isPresented: $showSettings) {
                SettingsView()
                    .environmentObject(appState)
            }
            .sheet(isPresented: $showProfileEdit) {
                ProfileEditView()
                    .environmentObject(appState)
            }
            .sheet(isPresented: $showMessageCenter) {
                MessageCenterView()
                    .environmentObject(appState)
                    .onDisappear { vm.refreshUnreadCount() }
            }
        }
    }

    private func messageCenterRow(showRedDot: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                ZStack(alignment: .topTrailing) {
                    Image(systemName: "bell")
                        .foregroundColor(AppTheme.primary)
                        .frame(width: 24, alignment: .center)
                    if showRedDot {
                        Circle()
                            .fill(Color.red)
                            .frame(width: 8, height: 8)
                            .offset(x: 6, y: -4)
                    }
                }
                Text("消息中心")
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundColor(AppTheme.secondaryText)
            }
        }
    }

    private var displayName: String {
        if let n = vm.user?.nickname, !n.isEmpty { return n }
        if let user = vm.user {
            return user.phone ?? user.email ?? user.id
        }
        return "未设置昵称"
    }

    private var profileAvatar: some View {
        Group {
            if let urlString = vm.user?.avatar, let url = URL(string: urlString) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    case .failure, .empty:
                        Image(systemName: "person.circle.fill")
                            .font(.system(size: 56))
                            .foregroundStyle(AppTheme.primary.opacity(0.6))
                    @unknown default:
                        EmptyView()
                    }
                }
                .frame(width: 56, height: 56)
                .clipShape(Circle())
            } else {
                Image(systemName: "person.circle.fill")
                    .font(.system(size: 56))
                    .foregroundStyle(AppTheme.primary.opacity(0.6))
            }
        }
    }

    private func row(icon: String, title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .foregroundColor(AppTheme.primary)
                    .frame(width: 24, alignment: .center)
                Text(title)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundColor(AppTheme.secondaryText)
            }
        }
    }
}
