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

    public init(vm: FamilyViewModel) {
        self.vm = vm
    }

    public var body: some View {
        NavigationStack {
            VStack(spacing: AppTheme.Spacing.lg) {
                hero
                codeField
                tipCard
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
            .background(code.count == 6 ? AppTheme.primary : AppTheme.primary.opacity(0.4))
            .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.medium))
        }
        .disabled(code.count != 6 || submitting)
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
            let ok = await vm.redeemInvite(code: code)
            submitting = false
            if ok { dismiss() }
            else if case .error(let msg) = vm.state {
                errorMessage = msg
            }
        }
    }
}
