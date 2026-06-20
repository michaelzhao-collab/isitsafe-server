//
//  ShareToFamilySheet.swift
//  IsItSafe
//
//  V3-E 主动分享一条信息到家庭（对应 mockup E-P6）
//  AI 检测后弹三种结果之一（scam 红 / safe 绿 / unknown 黄）
//

import SwiftUI

public struct ShareToFamilySheet: View {
    @ObservedObject var vm: FamilyViewModel
    @Environment(\.dismiss) private var dismiss
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    @State private var content: String = ""
    @State private var contentType: String = "sms"  // sms | url | phone | voice — 默认"消息"，最常用
    @State private var submitting = false
    @State private var result: BroadcastResponse?
    @State private var quotaRemaining: Int = 1

    public init(vm: FamilyViewModel, quotaRemaining: Int = 1) {
        self.vm = vm
        _quotaRemaining = State(initialValue: quotaRemaining)
    }

    public var body: some View {
        NavigationStack {
            ZStack {
                AppTheme.background.ignoresSafeArea()
                ScrollView {
                    VStack(spacing: AppTheme.Spacing.lg) {
                        hero
                        contentTypePicker
                        inputBox
                        quotaCard
                    }
                    .padding(AppTheme.Spacing.lg)
                }
                VStack {
                    Spacer()
                    submitBar
                }
            }
            .navigationTitle(languageCode == "en" ? "Share to Family" : "分享信息到家庭")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(languageCode == "en" ? "Cancel" : "取消") { dismiss() }
                }
            }
            .sheet(item: $result) { r in
                BroadcastResultSheet(result: r, onClose: {
                    result = nil
                    dismiss()
                })
            }
        }
    }

    private var hero: some View {
        HStack(spacing: 12) {
            Text("📢").font(.title)
            VStack(alignment: .leading, spacing: 4) {
                Text(languageCode == "en" ? "Official Anonymous Broadcast" : "官方匿名广播")
                    .font(.subheadline.weight(.semibold))
                Text(languageCode == "en"
                     ? "AI checks first. Sent as official notice — your identity stays hidden."
                     : "AI 先检测，按结果以「StarLens 官方」名义发，不会显示是谁分享的")
                    .font(.caption)
                    .foregroundColor(AppTheme.textSecondary)
            }
            Spacer(minLength: 0)
        }
        .padding(AppTheme.Spacing.md)
        .background(AppTheme.premiumWhyCard.opacity(0.45))
        .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.medium))
    }

    private var contentTypePicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(languageCode == "en" ? "What are you sharing?" : "内容类型")
                .font(.subheadline.weight(.semibold))
                .foregroundColor(AppTheme.textSecondary)
            Picker("", selection: $contentType) {
                Text(languageCode == "en" ? "Message" : "消息").tag("sms")
                Text(languageCode == "en" ? "Link" : "链接").tag("url")
                Text(languageCode == "en" ? "Phone" : "号码").tag("phone")
            }
            .pickerStyle(.segmented)
        }
    }

    private var inputBox: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(languageCode == "en" ? "Content" : "输入要分享的信息")
                .font(.subheadline.weight(.semibold))
                .foregroundColor(AppTheme.textSecondary)
            TextEditor(text: $content)
                .frame(minHeight: 120)
                .padding(8)
                .background(AppTheme.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.medium))
                .overlay(alignment: .topLeading) {
                    if content.isEmpty {
                        Text(languageCode == "en"
                             ? "Paste suspicious link / phone / SMS..."
                             : "粘贴可疑链接 / 号码 / 短信内容…")
                            .foregroundColor(AppTheme.textSecondary.opacity(0.7))
                            .padding(14)
                            .allowsHitTesting(false)
                    }
                }
            Text("\(content.count) / 2000")
                .font(.caption)
                .foregroundColor(AppTheme.textSecondary)
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
    }

    private var quotaCard: some View {
        HStack {
            Text("📊").font(.title3)
            VStack(alignment: .leading, spacing: 2) {
                Text(languageCode == "en" ? "Today's quota" : "今日配额")
                    .font(.caption)
                    .foregroundColor(AppTheme.textSecondary)
                Text(quotaRemaining > 0
                    ? (languageCode == "en"
                        ? "\(quotaRemaining) free broadcasts left today"
                        : "今日免费提醒剩余 \(quotaRemaining) 次")
                    : (languageCode == "en"
                        ? "Free quota used. Upgrade for unlimited."
                        : "免费配额已用完。家庭 Pro 不限"))
                    .font(.subheadline.weight(.medium))
            }
            Spacer()
        }
        .padding(AppTheme.Spacing.md)
        .background(AppTheme.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.medium))
    }

    private var submitBar: some View {
        Button {
            submit()
        } label: {
            HStack {
                if submitting { ProgressView().tint(.white) }
                Text(languageCode == "en" ? "AI Check & Broadcast" : "🔍 AI 检测并广播")
                    .font(.body.weight(.semibold))
            }
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                content.trimmingCharacters(in: .whitespacesAndNewlines).count >= 4
                    ? AppTheme.primary
                    : AppTheme.primary.opacity(0.4)
            )
            .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.medium))
        }
        .disabled(submitting || content.trimmingCharacters(in: .whitespacesAndNewlines).count < 4)
        .padding(AppTheme.Spacing.lg)
        .background(AppTheme.background)
    }

    private func submit() {
        submitting = true
        Task {
            let r = await vm.createBroadcast(contentType: contentType, content: content)
            submitting = false
            if let r = r { result = r }
        }
    }
}

extension BroadcastResponse: Identifiable {
    /// 稳定 id：必须确保同一个 BroadcastResponse 实例多次求值返回同一字符串
    /// 否则 .sheet(item:) 会反复 dismiss + re-present 死循环（之前用 UUID() 就是这个 bug）
    public var id: String {
        if let bid = broadcastId { return bid }
        // 没 broadcastId（quota_exceeded / no_group / duplicate / in_progress 等）：
        // 用 resultLabel + skipReason 派生稳定 key（同实例多次 get 一定相同）
        return "\(resultLabel.rawValue)#\(skipReasonEnum?.rawValue ?? "ok")"
    }
}

/// 三结果弹框
public struct BroadcastResultSheet: View {
    public let result: BroadcastResponse
    public let onClose: () -> Void
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"

    public var body: some View {
        VStack(spacing: 18) {
            badge
            Text(title)
                .font(.title3.weight(.bold))
                .multilineTextAlignment(.center)
            Text(message)
                .font(.subheadline)
                .foregroundColor(AppTheme.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
            actionButton
        }
        .padding(AppTheme.Spacing.xl)
        .presentationDetents([.fraction(0.45)])
        .presentationDragIndicator(.visible)
    }

    private var badge: some View {
        ZStack {
            Circle()
                .fill(themeColor.opacity(0.15))
                .frame(width: 72, height: 72)
            Text(emoji).font(.system(size: 36))
        }
    }

    private var themeColor: Color {
        switch result.resultLabel {
        case .scam: return AppTheme.riskHigh
        case .safe: return AppTheme.riskLow
        case .unknown: return AppTheme.riskMedium
        }
    }

    private var emoji: String {
        if result.skipReasonEnum == .duplicate { return "🔁" }
        if result.skipReasonEnum == .quotaExceeded { return "📊" }
        if result.skipReasonEnum == .noGroup { return "👥" }
        if result.skipReasonEnum == .inProgress { return "⏳" }
        if result.skipReasonEnum == .disabledByUser { return "🙈" }
        switch result.resultLabel {
        case .scam: return "🚨"
        case .safe: return "✅"
        case .unknown: return "⚠️"
        }
    }

    private var title: String {
        if result.skipReasonEnum == .duplicate {
            return languageCode == "en"
                ? "Already broadcast today"
                : "今日家庭已广播过此内容"
        }
        if result.skipReasonEnum == .quotaExceeded {
            return languageCode == "en"
                ? "Free quota used"
                : "今日免费配额已用完"
        }
        if result.skipReasonEnum == .noGroup {
            return languageCode == "en"
                ? "Not in a family group"
                : "你还没加入家庭组"
        }
        if result.skipReasonEnum == .inProgress {
            return languageCode == "en"
                ? "Broadcast in progress"
                : "正在广播中"
        }
        if result.skipReasonEnum == .disabledByUser {
            return languageCode == "en"
                ? "Family sharing turned off"
                : "已关闭家庭分享"
        }
        switch result.resultLabel {
        case .scam: return languageCode == "en" ? "Identified as scam" : "已识别为诈骗"
        case .safe: return languageCode == "en" ? "Verified safe" : "经核实暂未发现风险"
        case .unknown: return languageCode == "en" ? "Cannot verify" : "AI 暂无法确认"
        }
    }

    private var message: String {
        if result.skipReasonEnum == .duplicate {
            return languageCode == "en"
                ? "Same content was already broadcast today. Avoiding repeat alerts."
                : "同一内容今日已通过家庭官方广播过，避免重复打扰"
        }
        if result.skipReasonEnum == .quotaExceeded {
            return languageCode == "en"
                ? "Upgrade to Family Pro for unlimited official broadcasts"
                : "升级家庭 Pro 后可不限次"
        }
        if result.skipReasonEnum == .noGroup {
            return languageCode == "en"
                ? "Create or join a family group first"
                : "请先创建或加入家庭组"
        }
        if result.skipReasonEnum == .inProgress {
            return languageCode == "en"
                ? "Another broadcast for this content just kicked off. Please wait a moment."
                : "刚刚已经触发了一次广播，请稍候再试"
        }
        if result.skipReasonEnum == .disabledByUser {
            return languageCode == "en"
                ? "You turned off family broadcast in Settings. Enable it to share."
                : "你在设置里关掉了「分享我的查询结果」，开启后才会广播给家人"
        }
        switch result.resultLabel {
        case .scam:
            return languageCode == "en"
                ? "Has been broadcast officially to your family. Identity not shown."
                : "已以「StarLens 官方」名义广播给家庭其他成员（不显示你的身份）"
        case .safe:
            return languageCode == "en"
                ? "Confirmed safe — broadcast to family as official verification"
                : "经核实为安全，已以官方名义告知家人无需担心"
        case .unknown:
            return languageCode == "en"
                ? "AI couldn't decide. Broadcast as a warning to family."
                : "AI 暂无法判断真伪，已以官方名义提醒家人保持警惕"
        }
    }

    private var actionButton: some View {
        Button(action: onClose) {
            Text(languageCode == "en" ? "Got it" : "好的")
                .font(.body.weight(.semibold))
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(themeColor)
                .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.medium))
        }
        .padding(.top, 8)
    }
}
