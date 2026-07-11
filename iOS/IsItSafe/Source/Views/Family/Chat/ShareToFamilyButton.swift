//
//  ShareToFamilyButton.swift
//  IsItSafe
//
//  V5.1 求助闭环入口（T2-3）：AI 结果旁的「发到家庭群」按钮。
//  点击 → 把 AI 结论快照作为求助卡发进家庭群 → 子女 chips 拍板。
//  未加入家庭则引导去家庭 Tab 创建/加入。
//

import SwiftUI

public struct ShareToFamilyButton: View {
    let title: String        // 卡片标题（结论）
    let summary: String      // 摘要
    let riskLevel: String    // high/medium/low/unknown
    let conversationId: String?
    /// 长辈模式用更长的引导文案 + 更大尺寸
    let elder: Bool

    @ObservedObject private var chat = FamilyChatCoordinator.shared
    @ObservedObject private var router = AppRouter.shared
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    @State private var sent = false

    public init(title: String, summary: String, riskLevel: String, conversationId: String?, elder: Bool = false) {
        self.title = title
        self.summary = summary
        self.riskLevel = riskLevel
        self.conversationId = conversationId
        self.elder = elder
    }

    public var body: some View {
        Button(action: tap) {
            HStack(spacing: 8) {
                Image(systemName: sent ? "checkmark.circle.fill" : "person.2.fill")
                Text(labelText)
                    .font(.system(size: elder ? 17 : 14, weight: .semibold))
            }
            .foregroundColor(sent ? AppTheme.riskLow : AppTheme.primary)
            .frame(maxWidth: .infinity)
            .frame(height: elder ? 48 : 40)
            .background(RoundedRectangle(cornerRadius: 12)
                .stroke(sent ? AppTheme.riskLow.opacity(0.5) : AppTheme.primary.opacity(0.5), lineWidth: 1.5))
        }
        .disabled(sent)
    }

    private var labelText: String {
        if sent { return languageCode == "en" ? "Sent to family" : "已发给家人" }
        if elder { return languageCode == "en" ? "Ask my family to check" : "发到家庭群，让孩子们看看" }
        return languageCode == "en" ? "Send to family" : "发到家庭群"
    }

    private func tap() {
        guard let gid = chat.primaryGroupId, chat.hasFamily else {
            // 未加入家庭：跳家庭 Tab 引导
            router.pendingTabIndex = 2
            return
        }
        Task {
            let ok = await chat.sendHelpRequest(
                groupId: gid, title: title, summary: summary,
                riskLevel: normalizedRisk, refType: "conversation", refId: conversationId
            )
            if ok { sent = true }
        }
    }

    private var normalizedRisk: String {
        switch riskLevel.lowercased() {
        case "high": return "high"
        case "medium", "mid": return "medium"
        case "low": return "low"
        default: return "none"
        }
    }
}
