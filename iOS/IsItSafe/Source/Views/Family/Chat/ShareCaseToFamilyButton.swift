//
//  ShareCaseToFamilyButton.swift
//  IsItSafe
//
//  V5.1 案例/情报「发给家人」按钮（T2-5）。点击 → 案例卡进家庭群。
//

import SwiftUI

public struct ShareCaseToFamilyButton: View {
    let refType: String     // case | intel
    let refId: String
    let title: String
    let summary: String

    @ObservedObject private var chat = FamilyChatCoordinator.shared
    @ObservedObject private var router = AppRouter.shared
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    @State private var sent = false

    public init(refType: String, refId: String, title: String, summary: String) {
        self.refType = refType
        self.refId = refId
        self.title = title
        self.summary = summary
    }

    public var body: some View {
        Button(action: tap) {
            HStack(spacing: 6) {
                Image(systemName: sent ? "checkmark.circle.fill" : "paperplane.fill")
                Text(sent
                     ? (languageCode == "en" ? "Sent to family" : "已发给家人")
                     : (languageCode == "en" ? "Send to family" : "发给家人"))
                    .font(.system(size: 14, weight: .semibold))
            }
            .foregroundColor(sent ? AppTheme.riskLow : .white)
            .padding(.horizontal, 14).padding(.vertical, 8)
            .background {
                if sent {
                    Capsule().stroke(AppTheme.riskLow.opacity(0.5), lineWidth: 1.5)
                } else {
                    Capsule().fill(AppTheme.brandGradient)
                }
            }
        }
        .disabled(sent)
    }

    private func tap() {
        // 2026-09-07 复核：改为发到家庭页当前选中的群，而不是恒定第一个群
        guard let gid = FamilyShareTarget.groupId(chat), chat.hasFamily else {
            FamilyShareTarget.showNotReadyHint(languageCode: languageCode)
            router.pendingTabIndex = 2
            return
        }
        Task {
            let ok = await FamilyShareTarget.send(chat, gid: gid) { target in
                await chat.shareCase(groupId: target, refType: refType, refId: refId,
                                     title: title, summary: summary, riskLevel: "none")
            }
            if ok { sent = true }
        }
    }
}
