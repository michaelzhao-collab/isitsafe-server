//
//  BreachTargetDetailView.swift
//  IsItSafe
//
//  V3-F 监控目标详情（F-P3）
//
//  从 BreachMonitorView 点击 target 行进入：
//   - 头部：脱敏邮箱 + 验证状态 + 上次扫描时间
//   - 列表：本目标历史泄露记录（按 createdAt desc）
//   - 操作：删除目标（带二次确认）
//

import SwiftUI

public struct BreachTargetDetailView: View {
    public let target: BreachTargetItem
    public let allAlerts: [BreachAlert]
    public let onDelete: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var confirmDelete = false
    @State private var deleting = false
    @State private var errorMessage: String?

    public init(target: BreachTargetItem, allAlerts: [BreachAlert], onDelete: @escaping () -> Void) {
        self.target = target
        self.allAlerts = allAlerts
        self.onDelete = onDelete
    }

    private var targetAlerts: [BreachAlert] {
        allAlerts.filter { $0.targetId == target.id }
            .sorted { ($0.createdAt ?? "") > ($1.createdAt ?? "") }
    }

    public var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                headerCard
                if targetAlerts.isEmpty {
                    emptyState
                } else {
                    alertsList
                }
                deleteButton
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
        .background(AppTheme.background.ignoresSafeArea())
        .navigationTitle("Target Details")
        .navigationBarTitleDisplayMode(.inline)
        .alert("Delete this target?", isPresented: $confirmDelete) {
            Button("Cancel", role: .cancel) {}
            Button("Delete", role: .destructive) {
                Task { await performDelete() }
            }
        } message: {
            Text("All alerts for this email will also be removed. This cannot be undone.")
        }
    }

    private var headerCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "envelope.fill")
                    .foregroundColor(AppTheme.primary)
                Text(target.displayValue)
                    .font(.headline)
                Spacer()
                if target.verified {
                    Label("Verified", systemImage: "checkmark.seal.fill")
                        .font(.caption.weight(.semibold))
                        .foregroundColor(AppTheme.riskLow)
                } else {
                    Label("Pending", systemImage: "clock.fill")
                        .font(.caption.weight(.semibold))
                        .foregroundColor(AppTheme.riskMedium)
                }
            }
            Divider()
            HStack {
                StatTile(value: "\(target.alertCount)", label: "Total breaches")
                Divider().frame(height: 32)
                StatTile(value: lastScanRelative, label: "Last scan")
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppTheme.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private var emptyState: some View {
        VStack(spacing: 8) {
            Image(systemName: "checkmark.shield.fill")
                .font(.system(size: 42))
                .foregroundColor(AppTheme.riskLow)
            Text("No leaks found yet")
                .font(.subheadline.weight(.semibold))
            Text("We scan daily at 03:00 UTC. We'll notify you the moment your data shows up.")
                .font(.caption)
                .foregroundColor(AppTheme.textSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(32)
        .frame(maxWidth: .infinity)
        .background(AppTheme.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private var alertsList: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("History (\(targetAlerts.count))")
                .font(.subheadline.weight(.semibold))
                .foregroundColor(AppTheme.textSecondary)
            ForEach(targetAlerts) { a in
                NavigationLink {
                    BreachAlertDetailView(alert: a) {
                        onDelete()
                    }
                } label: {
                    alertRow(a)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func alertRow(_ a: BreachAlert) -> some View {
        HStack(spacing: 10) {
            Circle().fill(severityColor(a.severity)).frame(width: 8, height: 8)
            VStack(alignment: .leading, spacing: 2) {
                Text(a.breachName).font(.subheadline.weight(.semibold))
                Text(a.exposedData.joined(separator: ", "))
                    .font(.caption)
                    .foregroundColor(AppTheme.textSecondary)
                    .lineLimit(1)
            }
            Spacer()
            if a.dismissed {
                Text("Done")
                    .font(.caption2.weight(.semibold))
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(AppTheme.riskLow.opacity(0.15))
                    .foregroundColor(AppTheme.riskLow)
                    .clipShape(Capsule())
            } else {
                Text(a.severity.displayName)
                    .font(.caption2.weight(.bold))
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(severityColor(a.severity).opacity(0.15))
                    .foregroundColor(severityColor(a.severity))
                    .clipShape(Capsule())
            }
        }
        .padding(12)
        .background(AppTheme.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private var deleteButton: some View {
        VStack(spacing: 6) {
            if let err = errorMessage {
                Text(err).font(.caption).foregroundColor(AppTheme.riskHigh)
            }
            Button {
                confirmDelete = true
            } label: {
                HStack {
                    if deleting { ProgressView().tint(AppTheme.riskHigh) }
                    Label("Stop Monitoring This Email", systemImage: "trash")
                        .foregroundColor(AppTheme.riskHigh)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(AppTheme.riskHigh.opacity(0.4), lineWidth: 1)
                )
            }
            .disabled(deleting)
        }
    }

    private func performDelete() async {
        deleting = true
        errorMessage = nil
        do {
            try await BreachRepository.shared.deleteTarget(id: target.id)
            onDelete()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
            deleting = false
        }
    }

    private var lastScanRelative: String {
        guard let iso = target.lastScannedAt, let d = parseISO(iso) else { return "—" }
        let dt = -d.timeIntervalSinceNow
        if dt < 3600 { return "\(Int(dt/60))m" }
        if dt < 86400 { return "\(Int(dt/3600))h" }
        return "\(Int(dt/86400))d"
    }

    private func parseISO(_ s: String) -> Date? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.date(from: s) ?? {
            let f2 = ISO8601DateFormatter()
            f2.formatOptions = [.withInternetDateTime]
            return f2.date(from: s)
        }()
    }

    private func severityColor(_ s: BreachSeverity) -> Color {
        switch s {
        case .high: return AppTheme.riskHigh
        case .medium: return AppTheme.riskMedium
        case .low: return AppTheme.primary
        }
    }
}

private struct StatTile: View {
    let value: String
    let label: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value).font(.title3.weight(.bold))
            Text(label).font(.caption2).foregroundColor(AppTheme.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
