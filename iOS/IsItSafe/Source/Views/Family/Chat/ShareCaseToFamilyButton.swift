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
            .foregroundColor(sent ? AppTheme.riskLow : AppTheme.primary)
            .padding(.horizontal, 14).padding(.vertical, 8)
            .background(Capsule().stroke(
                (sent ? AppTheme.riskLow : AppTheme.primary).opacity(0.5), lineWidth: 1.5))
        }
        .disabled(sent)
    }

    private func tap() {
        guard let gid = chat.primaryGroupId, chat.hasFamily else {
            router.pendingTabIndex = 2
            return
        }
        Task {
            let ok = await chat.shareCase(groupId: gid, refType: refType, refId: refId,
                                          title: title, summary: summary, riskLevel: "none")
            if ok { sent = true }
        }
    }
}
