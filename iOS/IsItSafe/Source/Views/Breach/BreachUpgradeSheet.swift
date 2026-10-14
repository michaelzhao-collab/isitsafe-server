//
//  BreachUpgradeSheet.swift
//  IsItSafe
//
//  V3-F 引导付费（F-P5）
//
//  触发场景：免费用户尝试添加第 2 个监控邮箱时弹出。
//  内容：免费 vs Pro 对比表 + 升级 CTA + 「以后再说」关闭。
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
                    Button(L10n.tr(zh: "关闭", en: "Close")) { dismiss() }
                }
            }
        }
    }

    private var hero: some View {
        VStack(spacing: 10) {
            Image(systemName: "lock.shield.fill")
                .font(.system(size: 48))
                .foregroundColor(AppTheme.primaryTint)
            Text(L10n.tr(zh: "保护更多账号", en: "Protect more accounts"))
                .font(.title2.weight(.bold))
            Text(L10n.tr(zh: "免费版可监控 1 个邮箱。升级后可守护你的全部账号。", en: "Free includes 1 monitored email. Upgrade to keep all your accounts safe."))
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
                feature: L10n.tr(zh: "监控邮箱数", en: "Monitored emails"),
                free: "1",
                pro: "5"
            )
            Divider()
            tableRow(
                feature: L10n.tr(zh: "每日泄露扫描", en: "Daily breach scan"),
                free: "✓",
                pro: "✓"
            )
            // 2026-10-14：删掉「实时推送提醒」「信用卡监控」「家庭广播不限次」三行 ——
            // 泄露没有推送、信用卡监控不存在、家庭广播与本功能无关，付费页不能写没有的功能（App Store 3.1.2 / 2.3.1）
        }
        .background(AppTheme.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private var tableHeaderRow: some View {
        HStack {
            Text(L10n.tr(zh: "功能", en: "Feature"))
                .font(.caption.weight(.semibold))
                .foregroundColor(AppTheme.textSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text(L10n.tr(zh: "免费版", en: "Free"))
                .font(.caption.weight(.semibold))
                .frame(width: 60)
                .foregroundColor(AppTheme.textSecondary)
            Text("Pro")
                .font(.caption.weight(.bold))
                .frame(width: 60)
                .foregroundColor(AppTheme.primaryTint)
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
                .foregroundColor(AppTheme.primaryTint)
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
                Text(L10n.tr(zh: "升级 Pro", en: "Upgrade to Pro"))
                    .font(.body.weight(.semibold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(AppTheme.brandGradient)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            Button {
                dismiss()
            } label: {
                Text(L10n.tr(zh: "以后再说", en: "Maybe later"))
                    .font(.subheadline)
                    .foregroundColor(AppTheme.textSecondary)
                    .padding(.vertical, 6)
            }
        }
    }

    private var fineprint: some View {
        Text(L10n.tr(zh: "订阅会自动续费，可随时在「设置 → Apple ID → 订阅」中取消。", en: "Subscriptions renew automatically. Cancel anytime in Settings → Apple ID → Subscriptions."))
            .font(.caption2)
            .foregroundColor(AppTheme.textSecondary)
            .multilineTextAlignment(.center)
    }
}
