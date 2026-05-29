//
//  BreachMonitorView.swift
//  IsItSafe
//
//  V3-F 暗网监控主页（仅海外用户在 ProfileView 看得到入口）
//

import SwiftUI

public struct BreachMonitorView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppStateViewModel
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    @State private var targets: [BreachTargetItem] = []
    @State private var alerts: [BreachAlert] = []
    @State private var loading = true
    @State private var showAdd = false
    @State private var showUpgrade = false

    /// 免费用户最多 1 个 target；Pro 5 个（与 PRD 一致）
    private let freeTargetLimit = 1

    public init() {}

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    statusBanner
                    if !alerts.isEmpty {
                        alertsSection
                    }
                    targetsSection
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 16)
            }
            .background(AppTheme.background.ignoresSafeArea())
            .navigationTitle("Dark Web Monitor")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button { dismiss() } label: {
                        HStack {
                            Image(systemName: "chevron.left").font(.system(size: 17, weight: .semibold))
                            Text("Back")
                        }.foregroundColor(AppTheme.primary)
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button { tryShowAdd() } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .task { await reload() }
            .sheet(isPresented: $showAdd, onDismiss: { Task { await reload() } }) {
                BreachAddTargetSheet()
            }
            .sheet(isPresented: $showUpgrade) {
                BreachUpgradeSheet(onUpgrade: {
                    // 关掉本 sheet 后引导至订阅页（V3 一期暂用 Profile→订阅入口）
                })
            }
            .refreshable { await reload() }
        }
    }

    private var statusBanner: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("\(alerts.count) NEW ALERTS")
                .font(.caption2.weight(.heavy))
                .opacity(0.9)
            Text(alerts.isEmpty ? "No leaks detected" : "Your data is at risk")
                .font(.title3.weight(.bold))
            Text(targets.isEmpty
                 ? "Add an email to start monitoring"
                 : "Last scan: just now · Next scan in 23h")
                .font(.caption)
                .opacity(0.92)
        }
        .foregroundColor(.white)
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            LinearGradient(colors: alerts.isEmpty
                           ? [AppTheme.riskLow, AppTheme.primary]
                           : [AppTheme.riskMedium, AppTheme.riskHigh],
                           startPoint: .topLeading, endPoint: .bottomTrailing)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private var alertsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Recent Alerts (\(alerts.count))")
                .font(.subheadline.weight(.semibold))
                .foregroundColor(AppTheme.textSecondary)
            ForEach(alerts) { alert in
                NavigationLink {
                    BreachAlertDetailView(alert: alert) {
                        Task { await reload() }
                    }
                } label: {
                    alertCard(alert)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func alertCard(_ a: BreachAlert) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(a.severity.displayName)
                    .font(.caption2.weight(.bold))
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(severityColor(a.severity).opacity(0.15))
                    .foregroundColor(severityColor(a.severity))
                    .clipShape(Capsule())
                Spacer()
                Text(timeAgo(a.createdAt))
                    .font(.caption2)
                    .foregroundColor(AppTheme.textSecondary)
            }
            Text(a.breachName)
                .font(.subheadline.weight(.semibold))
                .foregroundColor(AppTheme.textPrimary)
            Text(a.exposedData.joined(separator: ", "))
                .font(.caption)
                .foregroundColor(AppTheme.textSecondary)
                .lineLimit(2)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppTheme.cardBackground)
        .overlay(
            HStack {
                Rectangle()
                    .fill(severityColor(a.severity))
                    .frame(width: 4)
                Spacer()
            }
        )
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private var targetsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Monitoring (\(targets.count))")
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(AppTheme.textSecondary)
                Spacer()
                Button { tryShowAdd() } label: {
                    Label("Add", systemImage: "plus.circle.fill")
                        .font(.caption.weight(.semibold))
                }
            }
            if loading {
                ProgressView().frame(maxWidth: .infinity)
            } else if targets.isEmpty {
                Button { tryShowAdd() } label: {
                    VStack(spacing: 6) {
                        Image(systemName: "envelope.badge")
                            .font(.system(size: 36))
                            .foregroundColor(AppTheme.primary)
                        Text("Add your email to start")
                            .font(.subheadline.weight(.semibold))
                            .foregroundColor(AppTheme.primary)
                        Text("Free: 1 email · Pro: 5 emails")
                            .font(.caption)
                            .foregroundColor(AppTheme.textSecondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 28)
                    .background(AppTheme.primary.opacity(0.08))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .buttonStyle(.plain)
            } else {
                ForEach(targets) { t in
                    NavigationLink {
                        // F-P3 目标详情
                        BreachTargetDetailView(target: t, allAlerts: alerts) {
                            Task { await reload() }
                        }
                    } label: {
                        targetRow(t)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    /// 检查是否触发付费墙：免费用户达到 freeTargetLimit 时弹 BreachUpgradeSheet
    private func tryShowAdd() {
        if !appState.subscriptionActive && targets.count >= freeTargetLimit {
            showUpgrade = true
            return
        }
        showAdd = true
    }

    private func targetRow(_ t: BreachTargetItem) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "envelope.fill")
                .foregroundColor(AppTheme.primary)
                .padding(10)
                .background(AppTheme.primary.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 8))
            VStack(alignment: .leading, spacing: 2) {
                Text(t.displayValue)
                    .font(.subheadline.weight(.medium))
                Text(t.alertCount > 0
                     ? "\(t.alertCount) breaches found"
                     : "No breaches yet")
                    .font(.caption)
                    .foregroundColor(t.alertCount > 0 ? AppTheme.riskHigh : AppTheme.textSecondary)
            }
            Spacer()
            if t.verified {
                Image(systemName: "checkmark.seal.fill")
                    .foregroundColor(AppTheme.riskLow)
            } else {
                Text("Pending")
                    .font(.caption2.weight(.bold))
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(AppTheme.riskMedium.opacity(0.15))
                    .foregroundColor(AppTheme.riskMedium)
                    .clipShape(Capsule())
            }
        }
        .padding(10)
        .background(AppTheme.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .swipeActions {
            Button(role: .destructive) {
                Task {
                    try? await BreachRepository.shared.deleteTarget(id: t.id)
                    await reload()
                }
            } label: {
                Label("Delete", systemImage: "trash")
            }
        }
    }

    private func severityColor(_ s: BreachSeverity) -> Color {
        switch s {
        case .high: return AppTheme.riskHigh
        case .medium: return AppTheme.riskMedium
        case .low: return AppTheme.primary
        }
    }

    private func timeAgo(_ iso: String?) -> String {
        guard let iso else { return "" }
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var d = f.date(from: iso)
        if d == nil {
            let f2 = ISO8601DateFormatter()
            f2.formatOptions = [.withInternetDateTime]
            d = f2.date(from: iso)
        }
        guard let date = d else { return "" }
        let dt = -date.timeIntervalSinceNow
        if dt < 3600 { return "\(Int(dt / 60))m ago" }
        if dt < 86400 { return "\(Int(dt / 3600))h ago" }
        return "\(Int(dt / 86400))d ago"
    }

    private func reload() async {
        loading = true
        async let t = (try? await BreachRepository.shared.listTargets()) ?? []
        async let a = (try? await BreachRepository.shared.listAlerts()) ?? []
        let (targetsResult, alertsResult) = await (t, a)
        targets = targetsResult
        alerts = alertsResult.filter { !$0.dismissed }
        loading = false
    }
}

// MARK: - 添加 / 详情 sheet

public struct BreachAddTargetSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var email = ""
    @State private var submitting = false
    @State private var errorMessage: String?

    public init() {}

    public var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                Text("Add monitoring target")
                    .font(.title3.weight(.bold))
                Text("We'll check this email against known data breaches every day. Your address is hashed and never stored in plain text.")
                    .font(.caption)
                    .foregroundColor(AppTheme.textSecondary)
                TextField("you@example.com", text: $email)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .padding(12)
                    .background(AppTheme.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                if let err = errorMessage {
                    Text(err).font(.caption).foregroundColor(AppTheme.riskHigh)
                }
                Spacer()
                Button {
                    submit()
                } label: {
                    HStack {
                        if submitting { ProgressView().tint(.white) }
                        Text("Start Monitoring").font(.body.weight(.semibold))
                    }
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(email.contains("@") ? AppTheme.primary : AppTheme.primary.opacity(0.4))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .disabled(submitting || !email.contains("@"))
            }
            .padding(16)
            .background(AppTheme.background.ignoresSafeArea())
            .navigationTitle("Add Target")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private func submit() {
        submitting = true
        errorMessage = nil
        Task {
            do {
                _ = try await BreachRepository.shared.addTarget(email: email.trimmingCharacters(in: .whitespacesAndNewlines))
                submitting = false
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
                submitting = false
            }
        }
    }
}

public struct BreachAlertDetailView: View {
    public let alert: BreachAlert
    public let onDismiss: () -> Void
    @Environment(\.dismiss) private var dismissEnv

    public init(alert: BreachAlert, onDismiss: @escaping () -> Void) {
        self.alert = alert
        self.onDismiss = onDismiss
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(alert.severity.displayName)
                        .font(.caption.weight(.heavy))
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(severityColor.opacity(0.15))
                        .foregroundColor(severityColor)
                        .clipShape(Capsule())
                    Text(alert.breachName)
                        .font(.title2.weight(.bold))
                    if let date = alert.breachDate {
                        Text(date)
                            .font(.caption)
                            .foregroundColor(AppTheme.textSecondary)
                    }
                }
                VStack(alignment: .leading, spacing: 6) {
                    Text("Your exposed data").font(.subheadline.weight(.semibold))
                    ForEach(alert.exposedData, id: \.self) { f in
                        HStack {
                            Image(systemName: "exclamationmark.circle.fill").foregroundColor(severityColor)
                            Text(f)
                        }
                        .font(.subheadline)
                    }
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(AppTheme.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: 12))

                VStack(alignment: .leading, spacing: 8) {
                    Text("Recommended actions").font(.subheadline.weight(.semibold))
                    Label("Change the password on this account", systemImage: "key.fill")
                    Label("Enable 2FA on important accounts", systemImage: "shield.lefthalf.filled")
                    Label("Check if reused on banking / email accounts", systemImage: "magnifyingglass")
                }
                .font(.subheadline)
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(AppTheme.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: 12))

                Button {
                    Task {
                        try? await BreachRepository.shared.dismissAlert(id: alert.id)
                        onDismiss()
                        dismissEnv()
                    }
                } label: {
                    Text("Mark as Done")
                        .font(.body.weight(.semibold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(AppTheme.primary)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
            }
            .padding(16)
        }
        .background(AppTheme.background.ignoresSafeArea())
        .navigationTitle("Alert")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var severityColor: Color {
        switch alert.severity {
        case .high: return AppTheme.riskHigh
        case .medium: return AppTheme.riskMedium
        case .low: return AppTheme.primary
        }
    }
}
