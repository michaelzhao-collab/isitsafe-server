//
//  InviteFamilySheet.swift
//  IsItSafe
//
//  V3-E 邀请家人页：显示邀请码 + 二维码 + 分享按钮（对应 mockup E-P3）
//

import SwiftUI

public struct InviteFamilySheet: View {
    public let group: FamilyGroup
    @ObservedObject var vm: FamilyViewModel
    @Environment(\.dismiss) private var dismiss
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    @State private var invite: GenerateInviteResponse?
    @State private var loading = true
    @State private var errorMessage: String?
    @State private var copied = false

    public init(group: FamilyGroup, vm: FamilyViewModel) {
        self.group = group
        self.vm = vm
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: AppTheme.Spacing.lg) {
                    hero
                    // 整页骨架式布局：code 卡 + actions 卡始终出现，loading 时仅在卡内显示占位/spinner
                    // 这样不再"两边空白等待"，结构稳定
                    if let err = errorMessage {
                        errorCard(message: err)
                    } else {
                        codeCard(invite: invite, loading: loading)
                        actionsCard(invite: invite, loading: loading)
                    }
                    warningCard
                    Spacer(minLength: 24)
                }
                .padding(AppTheme.Spacing.lg)
                .frame(maxWidth: .infinity)
            }
            .background(AppTheme.background)
            .navigationTitle(languageCode == "en" ? "Invite Family" : "邀请家人")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(languageCode == "en" ? "Done" : "完成") { dismiss() }
                }
            }
            .task { await load() }
        }
    }

    private var hero: some View {
        VStack(spacing: 4) {
            Text("📤").font(.system(size: 48))
            Text(languageCode == "en" ? "Share with family" : "分享邀请码")
                .font(.title3.weight(.bold))
            Text(group.displayName)
                .font(.subheadline)
                .foregroundColor(AppTheme.textSecondary)
        }
    }

    /// 邀请码卡：loading 时显示占位 "----" + 内嵌小菊花，不留大段空白
    private func codeCard(invite: GenerateInviteResponse?, loading: Bool) -> some View {
        VStack(spacing: 12) {
            Text(languageCode == "en" ? "Invite Code" : "邀请码")
                .font(.caption)
                .foregroundColor(AppTheme.textSecondary)
            HStack(spacing: 10) {
                Text(invite?.code ?? "————")
                    .font(.system(size: 38, weight: .bold, design: .monospaced))
                    .tracking(6)
                    .foregroundColor(invite == nil ? AppTheme.textSecondary.opacity(0.5) : AppTheme.primary)
                if loading {
                    ProgressView()
                        .scaleEffect(0.8)
                        .tint(AppTheme.textSecondary)
                }
            }
            Text(invite.map { expiryText($0.expiresAt) } ?? (languageCode == "en" ? "Generating…" : "生成中…"))
                .font(.caption)
                .foregroundColor(AppTheme.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(AppTheme.Spacing.lg)
        .background(AppTheme.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.medium))
    }

    /// 操作卡：按钮始终可见。loading / 失败时按钮 disabled 但样式不变（避免布局跳动）
    private func actionsCard(invite: GenerateInviteResponse?, loading: Bool) -> some View {
        VStack(spacing: 10) {
            Button {
                guard let invite else { return }
                UIPasteboard.general.string = invite.code
                copied = true
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { copied = false }
            } label: {
                HStack {
                    Image(systemName: copied ? "checkmark.circle.fill" : "doc.on.doc.fill")
                    Text(copied
                        ? (languageCode == "en" ? "Copied!" : "已复制")
                        : (languageCode == "en" ? "Copy Code" : "复制邀请码"))
                }
                .font(.body.weight(.semibold))
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(invite == nil ? AppTheme.primary.opacity(0.45) : AppTheme.primary)
                .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.medium))
            }
            .disabled(invite == nil)

            if let invite {
                ShareLink(item: shareText(invite: invite)) {
                    shareButtonLabel
                }
            } else {
                // 占位：保持版心，避免加载完瞬间页面抖动
                shareButtonLabel
                    .opacity(0.45)
                    .allowsHitTesting(false)
            }
        }
    }

    private var shareButtonLabel: some View {
        HStack {
            Image(systemName: "square.and.arrow.up")
            Text(languageCode == "en" ? "Share Invite Link" : "分享邀请链接")
        }
        .font(.body.weight(.semibold))
        .foregroundColor(AppTheme.primary)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(AppTheme.primary.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.medium))
    }

    private var warningCard: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(AppTheme.riskMedium)
            Text(languageCode == "en"
                 ? "Only share with trusted family members. Codes expire in 7 days."
                 : "邀请码请只发给可信家人。7 天后自动失效。")
                .font(.caption)
                .foregroundColor(AppTheme.textSecondary)
        }
        .padding(12)
        .background(Color.yellow.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.medium))
    }

    private func errorCard(message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.circle.fill")
                .font(.system(size: 32))
                .foregroundColor(AppTheme.riskHigh)
            Text(message)
                .font(.subheadline)
                .foregroundColor(AppTheme.textSecondary)
                .multilineTextAlignment(.center)
            Button(languageCode == "en" ? "Retry" : "重试") {
                Task { await load() }
            }
            .font(.body.weight(.semibold))
            .foregroundColor(AppTheme.primary)
        }
        .padding(.vertical, 32)
    }

    private func shareText(invite: GenerateInviteResponse) -> String {
        let appName = "StarLens AI"
        let code = invite.code
        let url = invite.shareLink
        return languageCode == "en"
            ? "Join my family on \(appName) — invite code: \(code). Open link: \(url)"
            : "我邀请你加入 \(appName) 家庭组。邀请码：\(code)。链接：\(url)"
    }

    private func expiryText(_ iso: String) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var date = f.date(from: iso)
        if date == nil {
            let f2 = ISO8601DateFormatter()
            f2.formatOptions = [.withInternetDateTime]
            date = f2.date(from: iso)
        }
        guard let d = date else { return "" }
        let days = max(0, Int(d.timeIntervalSinceNow / 86400))
        return languageCode == "en"
            ? "Expires in \(days) days · max 4 uses"
            : "\(days) 天后过期 · 最多 4 次使用"
    }

    private func load() async {
        loading = true
        errorMessage = nil
        if let r = await vm.generateInvite(groupId: group.id) {
            invite = r
        } else if case .error(let msg) = vm.state {
            errorMessage = msg
        }
        loading = false
    }
}
