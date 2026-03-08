//
//  SettingsView.swift
//  IsItSafe
//
//  系统设置：用户协议、隐私协议、字号设置、使用帮助、意见反馈、关于我们、退出登录。
//

import SwiftUI

public struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppStateViewModel
    @State private var showUserAgreement = false
    @State private var showPrivacyPolicy = false
    @State private var showHelp = false
    @State private var showFeedback = false
    @State private var showAbout = false
    @State private var showLogoutConfirm = false

    public init() {}

    public var body: some View {
        NavigationStack {
            List {
                if MockData.isMockModeEnabled {
                    Section {
                        HStack {
                            Text("当前为预览模式")
                            Spacer()
                            Text("假数据")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        Button("退出预览模式", role: .destructive) {
                            exitPreviewMode()
                            dismiss()
                        }
                    }
                }

                Section("系统设置") {
                    NavigationLink("用户协议") { WebPlaceholderView(title: "用户协议") }
                    NavigationLink("隐私协议") { WebPlaceholderView(title: "隐私协议") }
                    NavigationLink("字号设置") { FontSizeSettingsView() }
                    NavigationLink("使用帮助") { WebPlaceholderView(title: "使用帮助") }
                    NavigationLink("意见反馈") { WebPlaceholderView(title: "意见反馈") }
                    NavigationLink("关于我们") { WebPlaceholderView(title: "关于我们") }
                }

                if appState.isLoggedIn {
                    Section {
                        Button("退出登录", role: .destructive) {
                            showLogoutConfirm = true
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .background(AppTheme.background)
            .navigationTitle("系统设置")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("完成") { dismiss() }
                }
            }
            .confirmationDialog("退出登录", isPresented: $showLogoutConfirm) {
                Button("退出", role: .destructive) {
                    Task {
                        try? await AuthService.shared.logout()
                        await MainActor.run {
                            appState.exitGuestMode()
                            appState.refreshLoginState()
                            dismiss()
                        }
                    }
                }
                Button("取消", role: .cancel) { }
            } message: {
                Text("确定要退出登录吗？")
            }
        }
    }

    private func exitPreviewMode() {
        MockData.isMockModeEnabled = false
        UserSessionStore.shared.clearSession()
        appState.refreshLoginState()
    }
}

/// 占位：后续可替换为真实 WebView 或静态页
private struct WebPlaceholderView: View {
    let title: String
    var body: some View {
        Text("\(title) 页面建设中")
            .foregroundColor(AppTheme.secondaryText)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// 字号设置（示例：大/中/小）
private struct FontSizeSettingsView: View {
    @AppStorage("app.fontSize") private var fontSize: String = "medium"
    var body: some View {
        Picker("字号", selection: $fontSize) {
            Text("小").tag("small")
            Text("中").tag("medium")
            Text("大").tag("large")
        }
        .pickerStyle(.inline)
    }
}
