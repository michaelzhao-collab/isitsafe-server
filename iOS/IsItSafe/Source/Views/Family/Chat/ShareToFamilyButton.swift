//
//  ShareToFamilyButton.swift
//  IsItSafe
//
//  V5.1 求助闭环入口（T2-3）：AI 结果旁的「发到家庭群」按钮。
//  点击 → 把 AI 结论快照作为求助卡发进家庭群 → 子女 chips 拍板。
//  未加入家庭则引导去家庭 Tab 创建/加入。
//

import SwiftUI

/// 2026-09-07 复核：两个"发到家庭群"按钮原来都用 `chat.primaryGroupId`（= groupIds.first），
/// 与家庭 Tab 当前选中的群无关。用户在看「小强的家」，点发送却发进了「张家」。
/// 这里统一优先取家庭页持久化的当前选中群（FamilyViewModel 写的同一个 key），
/// 取不到或已不在群列表里时再回退 primaryGroupId。
enum FamilyShareTarget {
    static let selectedGroupIdKey = "isitsafe.family.selectedGroupId"

    static func groupId(_ chat: FamilyChatCoordinator) -> String? {
        guard let saved = UserDefaults.standard.string(forKey: selectedGroupIdKey), !saved.isEmpty else {
            return chat.primaryGroupId
        }
        // unreadByGroup 由服务端 unread-summary 下发，含我全部家庭；非空时可用来剔除失效的旧选中值。
        // 冷启动它还是空的，这时直接信任持久化值（FamilyViewModel 每次 refresh 都会重写这个 key）。
        if !chat.unreadByGroup.isEmpty && chat.unreadByGroup[saved] == nil {
            return chat.primaryGroupId
        }
        return saved
    }
}

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
        guard let gid = FamilyShareTarget.groupId(chat), chat.hasFamily else {
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
