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
    @State private var showAbout = false
    @State private var showLogoutConfirm = false
    @State private var showDeleteAccountPage = false
    /// S5-4 数据导出
    @State private var exporting = false
    @State private var exportShareURL: URL?
    @State private var exportError: String?
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"

    public init() {}

    public var body: some View {
        NavigationStack {
            List {
                if MockData.isMockModeEnabled {
                    Section {
                        HStack {
                            Text(languageCode == "en" ? "Preview mode" : "当前为预览模式")
                            Spacer()
                            Text(languageCode == "en" ? "Mock data" : "假数据")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        Button(languageCode == "en" ? "Exit preview" : "退出预览模式", role: .destructive) {
                            exitPreviewMode()
                            dismiss()
                        }
                    }
                }

                Section(languageCode == "en" ? "Accessibility" : "辅助功能") {
                    // V3-J 长辈模式：放在系统设置里，方便子女在长辈手机上一次性设置
                    elderModeToggleRow
                }

                Section(languageCode == "en" ? "Settings" : "系统设置") {
                    NavigationLink {
                        InAppWebView(url: AppTheme.termsURL, title: languageCode == "en" ? "User Agreement" : "用户协议")
                            .mainTabBarHidden()
                    } label: {
                        Text(languageCode == "en" ? "User Agreement" : "用户协议")
                    }
                    NavigationLink {
                        InAppWebView(url: AppTheme.privacyURL, title: languageCode == "en" ? "Privacy Policy" : "隐私协议")
                            .mainTabBarHidden()
                    } label: {
                        Text(languageCode == "en" ? "Privacy Policy" : "隐私协议")
                    }
                    NavigationLink(languageCode == "en" ? "Font size" : "字号设置") {
                        FontSizeSettingsView()
                            .mainTabBarHidden()
                    }
                    NavigationLink(languageCode == "en" ? "About" : "关于我们") {
                        AboutView()
                            .mainTabBarHidden()
                    }
                }

                if appState.isLoggedIn {
                    // S5-4 GDPR / 个保法数据导出
                    Section(footer: Text(languageCode == "en"
                                        ? "Includes account, queries, family activity, deepfake checks, and breach monitoring."
                                        : "包含账号、查询历史、家庭活动、深伪检测、暗网监控等全部记录。")) {
                        Button {
                            Task { await exportMyData() }
                        } label: {
                            HStack {
                                if exporting {
                                    ProgressView().scaleEffect(0.8)
                                } else {
                                    Image(systemName: "arrow.down.doc")
                                }
                                Text(languageCode == "en" ? "Export my data" : "导出我的数据")
                            }
                        }
                        .disabled(exporting)
                        if let err = exportError {
                            Text(err)
                                .font(.caption)
                                .foregroundColor(AppTheme.riskHigh)
                        }
                    }
                    Section {
                        Button(languageCode == "en" ? "Delete account" : "删除账号", role: .destructive) {
                            showDeleteAccountPage = true
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .background(AppTheme.background)
            .navigationTitle(languageCode == "en" ? "Settings" : "系统设置")
            .navigationBarTitleDisplayMode(.inline)
            .alert(languageCode == "en" ? "Log out" : "退出登录", isPresented: $showLogoutConfirm) {
                Button(languageCode == "en" ? "Cancel" : "取消", role: .cancel) {}
                Button(languageCode == "en" ? "Log out" : "退出", role: .destructive) {
                    Task {
                        try? await AuthService.shared.logout()
                        await MainActor.run {
                            appState.exitGuestMode()
                            appState.refreshLoginState()
                            dismiss()
                        }
                    }
                }
            } message: {
                Text(languageCode == "en" ? "Are you sure you want to log out?" : "确定要退出当前账号吗？")
            }
            .fullScreenCover(isPresented: $showDeleteAccountPage) {
                NavigationStack {
                    DeleteAccountView()
                        .environmentObject(appState)
                        .mainTabBarHidden()
                }
            }
            // S5-4 数据导出 share sheet
            .sheet(item: Binding(
                get: { exportShareURL.map(ShareableFile.init) },
                set: { exportShareURL = $0?.url }
            )) { file in
                ActivityViewController(items: [file.url])
            }
            .safeAreaInset(edge: .bottom) {
                if appState.isLoggedIn {
                    Button {
                        showLogoutConfirm = true
                    } label: {
                        HStack {
                            Spacer()
                            Text(languageCode == "en" ? "Log out" : "退出登录")
                                .font(.headline)
                                .foregroundColor(.white)
                            Spacer()
                        }
                        .frame(height: 48)
                        .background(Color.red)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 10)
                    .frame(maxWidth: .infinity)
                    .background(AppTheme.background)
                }
            }
        }
    }

    private func exitPreviewMode() {
        MockData.isMockModeEnabled = false
        UserSessionStore.shared.clearSession()
        appState.refreshLoginState()
    }

    /// S5-4 调 /api/auth/export-data 拉 JSON → 写临时文件 → 弹 ShareSheet
    @MainActor
    private func exportMyData() async {
        exporting = true
        exportError = nil
        defer { exporting = false }
        do {
            // 用 Any 接收，免去为完整结构定义 Decodable
            let json: [String: Any] = try await NetworkManager.shared.requestRawDictionary(
                endpoint: .authExportData
            )
            let data = try JSONSerialization.data(
                withJSONObject: json,
                options: [.prettyPrinted, .sortedKeys]
            )
            let ts = ISO8601DateFormatter().string(from: Date()).replacingOccurrences(of: ":", with: "-")
            let fileURL = FileManager.default.temporaryDirectory
                .appendingPathComponent("starlens-export-\(ts).json")
            try data.write(to: fileURL, options: .atomic)
            exportShareURL = fileURL
        } catch {
            exportError = languageCode == "en"
                ? "Export failed: \(error.localizedDescription)"
                : "导出失败：\(error.localizedDescription)"
        }
    }

    /// V3-J 长辈模式开关 row（开启会切换主界面到 ElderHomeView）
    private var elderModeToggleRow: some View {
        HStack(spacing: 12) {
            Image(systemName: "figure.stand")
                .font(.system(size: 18))
                .foregroundColor(AppTheme.primary)
                .frame(width: 24, alignment: .center)
            VStack(alignment: .leading, spacing: 2) {
                Text(languageCode == "en" ? "Elder Mode" : "长辈模式")
                    .font(.body)
                    .foregroundColor(.primary)
                Text(languageCode == "en"
                     ? "Bigger buttons + voice read-back"
                     : "字号放大、超大按钮、TTS 朗读")
                    .font(.caption)
                    .foregroundColor(AppTheme.textSecondary)
            }
            Spacer()
            Toggle("", isOn: Binding(
                get: { ElderModeService.shared.isEnabled },
                set: { v in
                    Task { await ElderModeService.shared.toggle(enabled: v) }
                }
            ))
            .labelsHidden()
            .tint(AppTheme.primary)
        }
    }
}

private struct DeleteAccountView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppStateViewModel
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    @State private var countdown = 10
    @State private var isSubmitting = false
    @State private var showConfirmAlert = false

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(languageCode == "en"
                 ? "After deleting your account, all your data will be permanently deleted and cannot be recovered."
                 : "删除账号后，您的所有数据将被永久删除，且无法恢复。")
                .font(.body)
                .foregroundColor(AppTheme.textPrimary)

            Text(languageCode == "en"
                 ? "This includes your query history, account information, and related data."
                 : "包括您的查询记录、账户信息等数据都将被清除。")
                .font(.body)
                .foregroundColor(AppTheme.textPrimary)

            Text(languageCode == "en"
                 ? "If you sign in again using the same phone number or email, you will be treated as a new user, and previous data cannot be restored."
                 : "请注意：使用相同手机号或邮箱再次登录时，将被视为新用户，无法恢复之前的数据。")
                .font(.body)
                .foregroundColor(AppTheme.textPrimary)

            Spacer()

            Button {
                showConfirmAlert = true
            } label: {
                HStack {
                    Spacer()
                    if isSubmitting {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                    } else if countdown > 0 {
                        Text(languageCode == "en" ? "Delete account (\(countdown)s)" : "删除账号（\(countdown)秒）")
                            .font(.headline)
                    } else {
                        Text(languageCode == "en" ? "Delete account" : "删除账号")
                            .font(.headline)
                    }
                    Spacer()
                }
                .frame(height: 48)
                .foregroundColor(.white)
                .background((countdown == 0 && !isSubmitting) ? Color.red : Color.red.opacity(0.35))
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(countdown > 0 || isSubmitting)
        }
        .padding(20)
        .navigationTitle(languageCode == "en" ? "Delete account" : "删除账号")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button(languageCode == "en" ? "Back" : "返回") {
                    dismiss()
                }
            }
        }
        .task {
            while countdown > 0 {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                if Task.isCancelled { break }
                countdown -= 1
            }
        }
        .alert(languageCode == "en" ? "Confirm deletion" : "确认删除", isPresented: $showConfirmAlert) {
            Button(languageCode == "en" ? "Cancel" : "取消", role: .cancel) {}
            Button(languageCode == "en" ? "Delete now" : "确认删除", role: .destructive) {
                submitDelete()
            }
        } message: {
            Text(languageCode == "en"
                 ? "This action is irreversible. Are you sure you want to delete your account?"
                 : "该操作不可撤销，确认删除当前账号吗？")
        }
    }

    private func submitDelete() {
        guard !isSubmitting else { return }
        isSubmitting = true
        Task {
            do {
                try await AuthService.shared.deleteAccount()
                await MainActor.run {
                    isSubmitting = false
                    appState.exitGuestMode()
                    appState.refreshLoginState()
                    AppStateViewModel.shared.showSuccess(languageCode == "en" ? "Deleted successfully" : "删除成功")
                    dismiss()
                }
            } catch {
                await MainActor.run {
                    isSubmitting = false
                    AppStateViewModel.shared.showError((error as? APIError)?.userMessage ?? error.localizedDescription)
                }
            }
        }
    }
}

/// 占位：后续可替换为真实 WebView 或静态页
private struct WebPlaceholderView: View {
    let title: String
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    var body: some View {
        Text(languageCode == "en" ? "\(title) (Coming soon)" : "\(title) 页面建设中")
            .foregroundColor(AppTheme.secondaryText)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// 字号设置：进度条方式，默认正常，可缩小或放大
private struct FontSizeSettingsView: View {
    @AppStorage("app.fontScale") private var fontScale: Double = 1.0
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    private let range: ClosedRange<Double> = 0.85...1.15

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text(languageCode == "en" ? "Small" : "小")
                    .font(.caption)
                    .foregroundColor(AppTheme.textSecondary)
                Slider(value: $fontScale, in: range, step: 0.05)
                Text(languageCode == "en" ? "Large" : "大")
                    .font(.caption)
                    .foregroundColor(AppTheme.textSecondary)
            }
            Text((languageCode == "en" ? "Current: " : "当前：") + scaleLabel)
                .font(.subheadline)
                .foregroundColor(AppTheme.textSecondary)
            Text(languageCode == "en" ? "Preview text" : "预览文字效果")
                .font(.system(size: 16 * fontScale))
                .foregroundColor(AppTheme.textPrimary)
                .padding(.top, 8)
        }
        .padding(.vertical, 8)
        .navigationTitle(languageCode == "en" ? "Font size" : "字号设置")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var scaleLabel: String {
        if fontScale <= 0.9 { return languageCode == "en" ? "Smaller" : "缩小" }
        if fontScale >= 1.1 { return languageCode == "en" ? "Larger" : "放大" }
        return languageCode == "en" ? "Normal" : "正常"
    }
}

