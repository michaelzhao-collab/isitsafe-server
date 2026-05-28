//
//  ProfileView.swift
//  IsItSafe
//
//  我的页面：头像+昵称、会员入口、消息中心、任务中心、系统设置。
//

import SwiftUI
import Foundation

private enum ProfileRoute: Hashable {
    case premium
    case memberCenter
    case messages
    case feedback
    case settings
    case breachMonitor
}

public struct ProfileView: View {
    @StateObject private var vm = ProfileViewModel()
    @State private var showProfileEdit = false
    @State private var selectedRoute: ProfileRoute?
    @EnvironmentObject private var appState: AppStateViewModel
    @EnvironmentObject private var router: AppRouter
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    @State private var showLanguageSheet = false
    @State private var tempLanguage: String = "zh"
    @State private var pendingMemberRoute = false

    public init() {}

    public var body: some View {
        NavigationStack {
            List {
                if appState.isLoggedIn {
                    // 顶部个人卡片：恢复纯白/系统背景
                    Section {
                        Button {
                            showProfileEdit = true
                        } label: {
                            VStack(spacing: 10) {
                                profileAvatar
                                    .frame(width: 72, height: 72)
                                Text(displayName)
                                    .font(.title3)
                                    .fontWeight(.semibold)
                                    .foregroundColor(profileNameColor)
                                Text(languageCode == "en" ? "Tap to edit profile" : "点击编辑个人资料")
                                    .font(.caption)
                                    .foregroundColor(profileSubtitleColor)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 18)
                        }
                        .buttonStyle(.plain)
                    }
                    .listRowInsets(EdgeInsets(top: 0, leading: 16, bottom: 8, trailing: 16))
                    .listRowBackground(profileCardBackground)
                    .listRowSeparator(.hidden)
                    .listSectionSeparator(.hidden)

                    // 会员入口：随会员状态切换，避免同时展示两种入口
                    Section {
                        let isMember = vm.isPremium
                        Button {
                            selectedRoute = isMember ? .memberCenter : .premium
                        } label: {
                            MemberEntryBanner(
                                isMember: isMember,
                                vipExpireDate: isMember ? vm.vipExpireDateText : nil
                            )
                        }
                        .buttonStyle(.plain)
                        .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                    }
                    .listSectionSeparator(.hidden)

                    Section {
                        // 顺序：消息中心、意见反馈、语言设置、系统设置（长辈模式已移到系统设置中）
                        Button {
                            // 立即清除红点，进入页面就消失，不等到离开时
                            appState.setHasUnreadMessages(false)
                            selectedRoute = .messages
                        } label: {
                            menuRow(
                                icon: "bell",
                                title: languageCode == "en" ? "Messages" : "消息中心",
                                showRedDot: vm.hasUnreadMessages
                            )
                        }
                        .buttonStyle(.plain)
                        .listRowSeparator(.hidden)
                        .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 0, trailing: 16))
                        .listRowBackground(profileCardBackground)
                        .overlay(bottomDivider, alignment: .bottom)

                        // V3-F 暗网监控入口（仅海外用户可见，region_code 不以 CN 开头）
                        if isOverseasUser {
                            Button {
                                selectedRoute = .breachMonitor
                            } label: {
                                menuRow(
                                    icon: "shield.lefthalf.filled",
                                    title: "Dark Web Monitor",
                                    showRedDot: false
                                )
                            }
                            .buttonStyle(.plain)
                            .listRowSeparator(.hidden)
                            .listRowInsets(EdgeInsets(top: 0, leading: 16, bottom: 0, trailing: 16))
                            .listRowBackground(profileCardBackground)
                            .overlay(bottomDivider, alignment: .bottom)
                        }

                        Button {
                            selectedRoute = .feedback
                        } label: {
                            menuRow(
                                icon: "bubble.left",
                                title: languageCode == "en" ? "Feedback" : "意见反馈",
                                showRedDot: false
                            )
                        }
                        .buttonStyle(.plain)
                        .listRowSeparator(.hidden)
                        .listRowInsets(EdgeInsets(top: 0, leading: 16, bottom: 0, trailing: 16))
                        .listRowBackground(profileCardBackground)
                        .overlay(bottomDivider, alignment: .bottom)

                        Button {
                            tempLanguage = effectiveLanguageTag
                            showLanguageSheet = true
                        } label: {
                            menuRow(
                                icon: "globe",
                                title: effectiveLanguageTag == "en" ? "Language" : "语言",
                                trailingText: effectiveLanguageTag == "en" ? "English" : "中文",
                                showRedDot: false
                            )
                        }
                        .buttonStyle(.plain)
                        .listRowSeparator(.hidden)
                        .listRowInsets(EdgeInsets(top: 0, leading: 16, bottom: 0, trailing: 16))
                        .listRowBackground(profileCardBackground)
                        .overlay(bottomDivider, alignment: .bottom)

                        Button {
                            selectedRoute = .settings
                        } label: {
                            menuRow(
                                icon: "gearshape",
                                title: languageCode == "en" ? "System Settings" : "系统设置",
                                showRedDot: false
                            )
                        }
                        .buttonStyle(.plain)
                        .listRowSeparator(.hidden)
                        .listRowInsets(EdgeInsets(top: 0, leading: 16, bottom: 6, trailing: 16))
                        .listRowBackground(profileCardBackground)
                    }
                    .listSectionSeparator(.hidden)
                }

                Section {
                    if !appState.isLoggedIn {
                        Button(languageCode == "en" ? "Log in" : "登录") {
                            router.showLogin()
                        }
                        .listRowSeparator(.hidden)
                    }
                }
                .listSectionSeparator(.hidden)
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .background(profilePageBackground)
            .listRowSeparator(.hidden)
            .listSectionSeparator(.hidden)
            .navigationTitle(languageCode == "en" ? "Profile" : "我的")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(profilePageBackground, for: .navigationBar)
            .onAppear { vm.refresh() }
            .onChange(of: pendingMemberRoute) { _, pending in
                guard pending else { return }
                selectedRoute = nil
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                    selectedRoute = .memberCenter
                    pendingMemberRoute = false
                }
            }
            .sheet(isPresented: $showProfileEdit, onDismiss: {
                vm.refresh()
            }) {
                ProfileEditView()
                    .environmentObject(appState)
                    .mainTabBarHidden()
            }
            .navigationDestination(item: $selectedRoute) { route in
                switch route {
                case .premium:
                    PremiumSubscriptionView(onSubscribed: {
                        vm.refresh()
                        pendingMemberRoute = true
                    })
                        .environmentObject(appState)
                        .mainTabBarHidden()
                case .memberCenter:
                    MemberCenterView()
                        .mainTabBarHidden()
                case .messages:
                    MessageCenterView()
                        .environmentObject(appState)
                        .onDisappear { vm.refreshUnreadCount() }
                        .mainTabBarHidden()
                case .feedback:
                    FeedbackView()
                        .mainTabBarHidden()
                case .settings:
                    SettingsView()
                        .environmentObject(appState)
                        .mainTabBarHidden()
                case .breachMonitor:
                    BreachMonitorView()
                        .mainTabBarHidden()
                }
            }
            .sheet(isPresented: $showLanguageSheet) {
                languageSheet
                    .mainTabBarHidden()
            }
            .onChange(of: showLanguageSheet) { _, showing in
                if showing { tempLanguage = effectiveLanguageTag }
            }
        }
    }

    // V3-F 暗网监控仅海外可见：region_code 为空或以 CN 开头视为国内用户
    private var isOverseasUser: Bool {
        guard let region = appState.user?.regionCode, !region.isEmpty else {
            // 兜底：根据系统语言推断（zh 用户视为国内）
            return !languageCode.lowercased().hasPrefix("zh")
        }
        return !region.uppercased().hasPrefix("CN")
    }

    private var bottomDivider: some View {
        Rectangle()
            .fill(profileDividerColor)
            .frame(height: 0.5)
            .padding(.leading, 36)
            // 通过 offset 将分割线下移到“上一行”和“下一行”之间
            .offset(y: 8)
    }

    private var profilePageBackground: Color {
        AppTheme.background
    }

    private var profileCardBackground: Color {
        AppTheme.background
    }

    private var profileNameColor: Color {
        vm.isPremium ? Color(hex: "5A2CA0") : .primary
    }

    private var profileSubtitleColor: Color {
        vm.isPremium ? Color(hex: "7A4CC0") : .secondary
    }

    private var profileDividerColor: Color {
        vm.isPremium ? Color(hex: "7A4CC0").opacity(0.35) : AppTheme.border.opacity(0.5)
    }

    private var effectiveLanguageTag: String {
        // AppStorage 里可能是 "en" / "zh" / "system"（当为 system 时按系统语言折算）
        switch languageCode {
        case "en": return "en"
        case "zh": return "zh"
        default:
            let lang = Locale.preferredLanguages.first ?? "en"
            return lang.hasPrefix("zh") ? "zh" : "en"
        }
    }

    /// 默认昵称：微信昵称优先，否则昵称；再否则手机号/邮箱「星识用户+后四位」
    private var displayName: String {
        guard let user = vm.user else { return languageCode == "en" ? "No nickname" : "未设置昵称" }
        if let n = user.wechatNickname, !n.isEmpty { return n }
        if let n = user.nickname, !n.isEmpty { return n }
        if let phone = user.phone, !phone.isEmpty {
            let last4 = phone.count >= 4 ? String(phone.suffix(4)) : phone
            return languageCode == "en" ? "User \(last4)" : "星识用户\(last4)"
        }
        if let email = user.email, !email.isEmpty {
            let last4 = email.count >= 4 ? String(email.suffix(4)) : email
            return languageCode == "en" ? "User \(last4)" : "星识用户\(last4)"
        }
        return languageCode == "en" ? "No nickname" : "未设置昵称"
    }

    private var profileAvatar: some View {
        ZStack(alignment: .bottomTrailing) {
            if let avatarURL = vm.user?.avatar, !avatarURL.isEmpty, let url = URL(string: avatarURL) {
                AsyncImage(url: url) { phase in
                    if let image = phase.image {
                        image
                            .resizable()
                            .scaledToFill()
                    } else {
                        avatarFallbackIcon
                    }
                }
                .frame(width: 72, height: 72)
                .clipShape(Circle())
                .overlay(
                    Circle()
                        .stroke(vm.isPremium ? Color(hex: "FFE8A3") : AppTheme.primary.opacity(0.35), lineWidth: 2)
                )
            } else {
                Circle()
                    .fill(vm.isPremium ? AnyShapeStyle(
                        LinearGradient(
                            colors: [Color(hex: "F7D774"), Color(hex: "C6932E")],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    ) : AnyShapeStyle(AppTheme.primary.opacity(0.18)))
                    .overlay(
                        Circle()
                            .stroke(vm.isPremium ? Color(hex: "FFE8A3") : AppTheme.primary.opacity(0.35), lineWidth: 2)
                    )
                    .overlay(avatarFallbackIcon)
            }
            if vm.isPremium {
                Image(systemName: "crown.fill")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(Color(hex: "FFE8A3"))
                    .padding(4)
                    .background(Color(hex: "8D5E12"))
                    .clipShape(Circle())
                    .offset(x: 4, y: 2)
            }
        }
    }

    private var avatarFallbackIcon: some View {
        Image(systemName: "person.fill")
            .font(.system(size: vm.isPremium ? 26 : 28, weight: .semibold))
            .foregroundColor(vm.isPremium ? Color(hex: "4A3500") : AppTheme.primary.opacity(0.75))
    }

    private func menuRow(icon: String, title: String, trailingText: String? = nil, showRedDot: Bool) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundColor(vm.isPremium ? Color(hex: "5A2CA0") : AppTheme.primary)
                .frame(width: 24, alignment: .center)
            Text(title)
                .foregroundColor(vm.isPremium ? Color(hex: "5A2CA0") : AppTheme.textPrimary)
            Spacer()
            if let trailingText, !trailingText.isEmpty {
                Text(trailingText)
                    .font(.subheadline)
                    .foregroundColor(vm.isPremium ? Color(hex: "7A4CC0") : AppTheme.secondaryText)
            }
            if showRedDot {
                Circle()
                    .fill(Color.red)
                    .frame(width: 8, height: 8)
            }
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(vm.isPremium ? Color(hex: "7A4CC0") : AppTheme.secondaryText)
        }
    }

    private var languageSheet: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                Text(effectiveLanguageTag == "en" ? "Language" : "语言")
                    .font(.headline)
                    .padding(.top, 8)
                Picker("", selection: $tempLanguage) {
                    Text("中文").tag("zh")
                    Text("English").tag("en")
                }
                .pickerStyle(.segmented)
                .tint(AppTheme.primary)
                Spacer()
            }
            .onAppear { tempLanguage = effectiveLanguageTag }
            .padding(20)
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(effectiveLanguageTag == "en" ? "Confirm" : "确定") {
                        languageCode = tempLanguage
                        showLanguageSheet = false
                    }
                }
            }
        }
        .presentationDetents([.height(220)])
        .presentationDragIndicator(.visible)
    }
}
