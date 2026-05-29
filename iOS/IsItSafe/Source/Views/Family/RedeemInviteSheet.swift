//
//  RedeemInviteSheet.swift
//  IsItSafe
//
//  V3-E 兑换邀请码（加入已有家庭组）
//

import SwiftUI

public struct RedeemInviteSheet: View {
    @ObservedObject var vm: FamilyViewModel
    @Environment(\.dismiss) private var dismiss
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    @State private var code: String = ""
    @State private var submitting = false
    @State private var errorMessage: String?
    /// S3-3 COPPA：默认勾上"我已年满 13 岁或已获得监护人同意"
    /// 用户主动取消勾选 → 提交按钮置灰。服务端会落审计 parent_consent_at。
    @State private var consentConfirmed: Bool = true

    private let prefilledCode: String?

    public init(vm: FamilyViewModel, prefilledCode: String? = nil) {
        self.vm = vm
        self.prefilledCode = prefilledCode
        if let code = prefilledCode {
            _code = State(initialValue: String(code.uppercased().prefix(6)))
        }
    }

    public var body: some View {
        NavigationStack {
            VStack(spacing: AppTheme.Spacing.lg) {
                hero
                codeField
                tipCard
                consentCheckbox
                submitButton
                Spacer()
            }
            .padding(AppTheme.Spacing.lg)
            .background(AppTheme.background)
            .navigationTitle(languageCode == "en" ? "Join Family" : "加入家庭组")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(languageCode == "en" ? "Cancel" : "取消") { dismiss() }
                }
            }
        }
    }

    private var hero: some View {
        VStack(spacing: 6) {
            Image(systemName: "envelope.open.fill")
                .font(.system(size: 48))
                .foregroundColor(AppTheme.primary)
                .padding(.top, 12)
            Text(languageCode == "en" ? "Enter invite code" : "输入邀请码")
                .font(.title3.weight(.bold))
            Text(languageCode == "en"
                 ? "6-character code from your family"
                 : "家人分享的 6 位邀请码")
                .font(.subheadline)
                .foregroundColor(AppTheme.textSecondary)
        }
    }

    private var codeField: some View {
        VStack(spacing: 8) {
            TextField("", text: $code, prompt: Text("ABC123"))
                .font(.system(size: 32, weight: .bold, design: .monospaced))
                .multilineTextAlignment(.center)
                .textInputAutocapitalization(.characters)
                .autocorrectionDisabled()
                .padding(.vertical, 16)
                .background(AppTheme.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.medium))
                .onChange(of: code) { _, newValue in
                    // 强制大写 + 限长
                    let normalized = newValue.uppercased().filter { $0.isLetter || $0.isNumber }
                    if normalized != newValue {
                        code = String(normalized.prefix(6))
                    } else if normalized.count > 6 {
                        code = String(normalized.prefix(6))
                    }
                    errorMessage = nil
                }
            if let msg = errorMessage {
                Text(msg)
                    .font(.caption)
                    .foregroundColor(AppTheme.riskHigh)
            }
        }
    }

    private var tipCard: some View {
        HStack(spacing: 10) {
            Image(systemName: "info.circle.fill")
                .foregroundColor(AppTheme.primary)
            Text(languageCode == "en"
                 ? "Only share invite codes with trusted family members."
                 : "邀请码请只发给可信家人。不要在公开网络分享。")
                .font(.caption)
                .foregroundColor(AppTheme.textSecondary)
        }
        .padding(12)
        .background(AppTheme.primary.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.medium))
    }

    /// S3-3 COPPA 合规勾选；默认勾上以减少摩擦，用户可主动取消
    private var consentCheckbox: some View {
        Button {
            consentConfirmed.toggle()
        } label: {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: consentConfirmed ? "checkmark.square.fill" : "square")
                    .foregroundColor(consentConfirmed ? AppTheme.primary : AppTheme.textSecondary)
                    .font(.system(size: 18))
                Text(languageCode == "en"
                     ? "I am at least 13 years old, or my parent/guardian consents to me joining this family group."
                     : "我已年满 13 岁，或已获得监护人同意加入此家庭组。")
                    .font(.caption)
                    .foregroundColor(AppTheme.textSecondary)
                    .multilineTextAlignment(.leading)
                Spacer(minLength: 0)
            }
        }
        .buttonStyle(.plain)
    }

    private var submitButton: some View {
        Button {
            submit()
        } label: {
            HStack {
                if submitting { ProgressView().tint(.white) }
                Text(languageCode == "en" ? "Join Family Group" : "加入家庭组")
                    .font(.body.weight(.semibold))
            }
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(canSubmit ? AppTheme.primary : AppTheme.primary.opacity(0.4))
            .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.medium))
        }
        .disabled(!canSubmit)
    }

    private var canSubmit: Bool {
        code.count == 6 && consentConfirmed && !submitting
    }

    private func submit() {
        guard code.count == 6 else {
            errorMessage = languageCode == "en"
                ? "Invite code must be 6 characters"
                : "邀请码应为 6 位"
            return
        }
        submitting = true
        errorMessage = nil
        Task {
            // 用户勾上即视为给出 parentConsent 证据；服务端只在 isMinor=true 时强制要求
            let ok = await vm.redeemInvite(code: code, parentConsent: consentConfirmed)
            submitting = false
            if ok { dismiss() }
            else if case .error(let msg) = vm.state {
                errorMessage = msg
            }
        }
    }
}
