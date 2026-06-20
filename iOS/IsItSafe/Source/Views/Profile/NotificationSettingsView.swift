//
//  NotificationSettingsView.swift
//  IsItSafe
//
//  V4 通知偏好：业主反馈"家人长期不活跃会一直收到关怀 push"
//  在 App 设置里提供两个开关：
//   - 接收所有通知：总开关，关掉后非交易类 push 全不发
//   - 家人不活跃提醒：单独关掉 family_care category，其它通知不受影响
//

import SwiftUI

public struct NotificationSettingsView: View {
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    @State private var allEnabled = true
    @State private var familyCareEnabled = true
    @State private var loaded = false
    @State private var saving = false
    @State private var errorMessage: String?

    public init() {}

    public var body: some View {
        Form {
            Section(footer: Text(languageCode == "en"
                                 ? "When OFF, IsItSafe won't send any in-app push notifications. You can still receive system alerts (iOS settings)."
                                 : "关闭后，IsItSafe 不会发送任何 App 内业务通知。iOS 系统通知中心仍可在「设置 → 通知」单独管理。")) {
                Toggle(isOn: $allEnabled) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(languageCode == "en" ? "Receive all notifications" : "接收所有通知")
                        Text(languageCode == "en"
                             ? "Master switch for all push notifications"
                             : "全部业务推送的总开关")
                            .font(.caption)
                            .foregroundColor(AppTheme.textSecondary)
                    }
                }
                .disabled(!loaded || saving)
                .onChange(of: allEnabled) { _, newValue in
                    save(allEnabled: newValue, familyCareEnabled: familyCareEnabled)
                }
            }

            Section(footer: Text(languageCode == "en"
                                 ? "When OFF, you won't get \"family member hasn't opened the app for N days\" reminders. The other family member can still ping you in person."
                                 : "关闭后，将不再收到「家人连续 N 天未打开 App」的关怀提醒。家人本人仍可主动联系你。")) {
                Toggle(isOn: $familyCareEnabled) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(languageCode == "en" ? "Family inactivity alerts" : "家人不活跃提醒")
                        Text(languageCode == "en"
                             ? "Reminders when a family member hasn't opened the app for a while"
                             : "家人长期未上线时的关怀通知")
                            .font(.caption)
                            .foregroundColor(AppTheme.textSecondary)
                    }
                }
                .disabled(!loaded || saving || !allEnabled)
                .onChange(of: familyCareEnabled) { _, newValue in
                    save(allEnabled: allEnabled, familyCareEnabled: newValue)
                }
            }

            if let err = errorMessage {
                Section { Text(err).font(.caption).foregroundColor(AppTheme.riskHigh) }
            }
        }
        .navigationTitle(languageCode == "en" ? "Notifications" : "通知设置")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadPrefs() }
    }

    private func loadPrefs() async {
        do {
            let prefs: NotificationPrefsDTO = try await NetworkManager.shared.request(
                endpoint: .v3UserGetNotificationPrefs
            )
            await MainActor.run {
                allEnabled = prefs.pushAllEnabled
                familyCareEnabled = prefs.pushFamilyCareEnabled
                loaded = true
            }
        } catch {
            await MainActor.run {
                errorMessage = (error as? APIError)?.userMessage ?? error.localizedDescription
                loaded = true   // 让 toggle 可交互（写时再试一次）
            }
        }
    }

    private func save(allEnabled: Bool, familyCareEnabled: Bool) {
        guard loaded, !saving else { return }
        saving = true
        errorMessage = nil
        Task {
            do {
                let body = NotificationPrefsDTO(
                    pushAllEnabled: allEnabled,
                    pushFamilyCareEnabled: familyCareEnabled
                )
                let result: NotificationPrefsDTO = try await NetworkManager.shared.request(
                    endpoint: .v3UserPutNotificationPrefs,
                    body: body
                )
                await MainActor.run {
                    self.allEnabled = result.pushAllEnabled
                    self.familyCareEnabled = result.pushFamilyCareEnabled
                    self.saving = false
                }
            } catch {
                await MainActor.run {
                    errorMessage = (error as? APIError)?.userMessage ?? error.localizedDescription
                    saving = false
                    // 失败时回滚 UI 与上次成功状态一致
                    Task { await loadPrefs() }
                }
            }
        }
    }
}

private struct NotificationPrefsDTO: Codable {
    let pushAllEnabled: Bool
    let pushFamilyCareEnabled: Bool
}
