//
//  BreachUpgradeSheet.swift
//  IsItSafe
//
//  V3-F 引导付费（F-P5）
//
//  触发场景：免费用户尝试添加第 2 个监控邮箱时弹出。
//  内容：免费 vs Pro 对比表 + 升级 CTA + "Maybe later" 关闭。
//

import SwiftUI

public struct BreachUpgradeSheet: View {
    @Environment(\.dismiss) private var dismiss
    public let onUpgrade: () -> Void

    public init(onUpgrade: @escaping () -> Void) {
        self.onUpgrade = onUpgrade
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 22) {
                    hero
                    comparisonTable
                    ctaButtons
                    fineprint
                }
                .padding(.horizontal, 18)
                .padding(.vertical, 16)
            }
            .background(AppTheme.background.ignoresSafeArea())
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Close") { dismiss() }
                }
            }
        }
    }

    private var hero: some View {
        VStack(spacing: 10) {
            Image(systemName: "lock.shield.fill")
                .font(.system(size: 48))
                .foregroundColor(AppTheme.primary)
            Text("Protect more accounts")
                .font(.title2.weight(.bold))
            Text("Free includes 1 monitored email. Upgrade to keep all your accounts safe.")
                .font(.subheadline)
                .foregroundColor(AppTheme.textSecondary)
                .multilineTextAlignment(.center)
        }
    }

    private var comparisonTable: some View {
        VStack(spacing: 0) {
            tableHeaderRow
            Divider()
            tableRow(
                feature: "Monitored emails",
                free: "1",
                pro: "5"
            )
            Divider()
            tableRow(
                feature: "Daily HIBP scan",
                free: "✓",
                pro: "✓"
            )
            Divider()
            tableRow(
                feature: "Real-time push alerts",
                free: "✓",
                pro: "✓"
            )
            Divider()
            tableRow(
                feature: "Credit card monitoring",
                free: "—",
                pro: "Coming"
            )
            Divider()
            tableRow(
                feature: "Family broadcasts unlimited",
                free: "1/day",
                pro: "Unlimited"
            )
        }
        .background(AppTheme.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private var tableHeaderRow: some View {
        HStack {
            Text("Feature")
                .font(.caption.weight(.semibold))
                .foregroundColor(AppTheme.textSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text("Free")
                .font(.caption.weight(.semibold))
                .frame(width: 60)
                .foregroundColor(AppTheme.textSecondary)
            Text("Pro")
                .font(.caption.weight(.bold))
                .frame(width: 60)
                .foregroundColor(AppTheme.primary)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
    }

    private func tableRow(feature: String, free: String, pro: String) -> some View {
        HStack {
            Text(feature)
                .font(.subheadline)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text(free)
                .font(.subheadline)
                .foregroundColor(AppTheme.textSecondary)
                .frame(width: 60)
            Text(pro)
                .font(.subheadline.weight(.semibold))
                .foregroundColor(AppTheme.primary)
                .frame(width: 60)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
    }

    private var ctaButtons: some View {
        VStack(spacing: 8) {
            Button {
                onUpgrade()
                dismiss()
            } label: {
                Text("Upgrade to Pro")
                    .font(.body.weight(.semibold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(AppTheme.primary)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            Button {
                dismiss()
            } label: {
                Text("Maybe later")
                    .font(.subheadline)
                    .foregroundColor(AppTheme.textSecondary)
                    .padding(.vertical, 6)
            }
        }
    }

    private var fineprint: some View {
        Text("Subscriptions renew automatically. Cancel anytime in Settings → Apple ID → Subscriptions.")
            .font(.caption2)
            .foregroundColor(AppTheme.textSecondary)
            .multilineTextAlignment(.center)
    }
}
