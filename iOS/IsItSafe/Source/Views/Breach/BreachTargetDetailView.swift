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
                if let summary = target.exposedSummary, summary.count > 1 {
                    exposedSummaryCard(summary)
                }
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
        .navigationTitle(L10n.tr(zh: "监控详情", en: "Target Details"))
        .navigationBarTitleDisplayMode(.inline)
        .alert(L10n.tr(zh: "删除这个监控对象？", en: "Delete this target?"), isPresented: $confirmDelete) {
            Button(L10n.tr(zh: "取消", en: "Cancel"), role: .cancel) {}
            Button(L10n.tr(zh: "删除", en: "Delete"), role: .destructive) {
                Task { await performDelete() }
            }
        } message: {
            Text(L10n.tr(zh: "该邮箱的所有警报也会一并删除，操作不可撤销。", en: "All alerts for this email will also be removed. This cannot be undone."))
        }
    }

    private var headerCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "envelope.fill")
                    .foregroundColor(AppTheme.primaryTint)
                Text(target.displayValue)
                    .font(.headline)
                Spacer()
                if target.effectiveScanStatus == "failed" {
                    Label(L10n.tr(zh: "扫描失败", en: "Scan failed"), systemImage: "exclamationmark.triangle.fill")
                        .font(.caption.weight(.semibold))
                        .foregroundColor(AppTheme.riskMedium)
                } else if target.verified {
                    Label(L10n.tr(zh: "已验证", en: "Verified"), systemImage: "checkmark.seal.fill")
                        .font(.caption.weight(.semibold))
                        .foregroundColor(AppTheme.riskLow)
                } else {
                    Label(L10n.tr(zh: "待验证", en: "Pending"), systemImage: "clock.fill")
                        .font(.caption.weight(.semibold))
                        .foregroundColor(AppTheme.riskMedium)
                }
            }
            Divider()
            HStack {
                StatTile(value: "\(target.alertCount)", label: L10n.tr(zh: "泄露总数", en: "Total breaches"))
                Divider().frame(height: 32)
                StatTile(value: lastScanRelative, label: L10n.tr(zh: "上次扫描", en: "Last scan"))
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppTheme.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    @ViewBuilder
    /// 合计暴露过的数据类型：只在这里显示一次（免费数据源给不到每次泄露各自暴露了什么）
    private func exposedSummaryCard(_ items: [String]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(L10n.tr(zh: "在这些泄露中合计暴露过的数据类型", en: "Data types exposed across these breaches"))
                .font(.subheadline.weight(.semibold))
            Text(items.joined(separator: " · "))
                .font(.caption)
                .foregroundColor(AppTheme.textSecondary)
            Text(L10n.tr(zh: "如果包含密码：请尽快修改用过这个密码的所有账号，并开启两步验证。", en: "If passwords are listed, change them on every account that used them and turn on two-factor authentication."))
                .font(.caption2)
                .foregroundColor(AppTheme.textSecondary)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppTheme.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    @ViewBuilder
    private var emptyState: some View {
        let failed = target.effectiveScanStatus == "failed"
        let scanned = target.effectiveScanStatus == "ok"
        VStack(spacing: 8) {
            Image(systemName: failed ? "exclamationmark.triangle.fill" : (scanned ? "checkmark.shield.fill" : "clock.fill"))
                .font(.system(size: 42))
                .foregroundColor(failed ? AppTheme.riskMedium : (scanned ? AppTheme.riskLow : AppTheme.textSecondary))
            Text(failed
                 ? L10n.tr(zh: "暂时无法扫描", en: "Couldn't scan yet")
                 : (scanned ? L10n.tr(zh: "未发现泄露", en: "No breaches found") : L10n.tr(zh: "等待首次扫描", en: "Waiting for the first scan")))
                .font(.subheadline.weight(.semibold))
            // 2026-10-14：原文案「一旦发现会第一时间通知你」不实（没有泄露推送），改为如实描述
            Text(failed
                 ? L10n.tr(zh: "这不代表安全。我们会在下一次每日扫描时自动重试。", en: "This doesn't mean you're safe. We'll retry in the next daily scan.")
                 : L10n.tr(zh: "我们每天自动扫描一次。打开本页即可查看最新结果。", en: "We scan once a day. Open this page to see the latest results."))
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
            Text(L10n.tr(zh: "历史记录（\(targetAlerts.count)）", en: "History (\(targetAlerts.count))"))
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
                Text(L10n.tr(zh: "完成", en: "Done"))
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
                    Label(L10n.tr(zh: "停止监控这个邮箱", en: "Stop monitoring this email"), systemImage: "trash")
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
        guard let iso = target.lastScannedAt, let d = BreachDates.parse(iso) else { return "—" }
        return BreachDates.relative(d)
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

    private func severityColor(_ s: BreachSeverity) -> Color { BreachColors.severity(s) }
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
