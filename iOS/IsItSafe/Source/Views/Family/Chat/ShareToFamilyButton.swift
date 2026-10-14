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

    /// 「发到家庭群」按钮在没有可用群时的提示。只看 IM 协调器的 hasFamily 会说错话：
    /// 冷启动 unread-summary 还没回来、或服务端 familyChatEnabled=false 时协调器永远没群，
    /// 但用户其实有家庭。用本地「当前选中群」区分：FamilyViewModel 只在确认没有家庭时才清掉它。
    @MainActor
    static func showNotReadyHint(languageCode: String) {
        let en = languageCode == "en"
        let hasSelected = !(UserDefaults.standard.string(forKey: selectedGroupIdKey) ?? "").isEmpty
        AppStateViewModel.shared.showError(hasSelected
            ? (en ? "Family chat is still connecting. Please try again shortly." : "家庭群还在连接中，请稍后再试")
            : (en ? "You haven't joined a family yet. Create or join one first." : "你还没有家庭群，先去创建或加入一个吧"))
    }

    /// 发送并给出反馈：成功 → 选中该群并跳家庭 Tab；失败 → toast。2026-10-06：原来失败被吞掉，按钮点了毫无反应。
    /// 不做「换一个群重发」：超时可能服务端其实已写入，换群重发会让内容进到用户没选的另一个家庭。
    /// 失效的选中群由 groupId(_:) 剔除，登出时也会清掉选中群。
    @MainActor
    static func send(_ chat: FamilyChatCoordinator, gid: String, _ op: (String) async -> Bool) async -> Bool {
        let ok = await op(gid)
        if ok {
            UserDefaults.standard.set(gid, forKey: selectedGroupIdKey)
            AppRouter.shared.pendingTabIndex = 2
        } else {
            let en = (UserDefaults.standard.string(forKey: "isitsafe.language") ?? "zh") == "en"
            AppStateViewModel.shared.showError(en ? "Failed to send. Please try again." : "发送失败，请稍后重试")
        }
        return ok
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
    @State private var sending = false

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
                if sending {
                    ProgressView().tint(.white)
                } else {
                    Image(systemName: sent ? "checkmark.circle.fill" : "person.2.fill")
                }
                Text(labelText)
                    .font(.system(size: elder ? 17 : 14, weight: .semibold))
            }
            // 2026-10-14 配色 V2：未发送 → 主色渐变实心白字；已发送 → 绿色描边
            .foregroundColor(sent ? AppTheme.riskLow : .white)
            .frame(maxWidth: .infinity)
            .frame(height: elder ? 48 : 40)
            .background {
                if sent {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(AppTheme.riskLow.opacity(0.5), lineWidth: 1.5)
                } else {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(AppTheme.brandGradient)
                        .shadow(color: AppTheme.primary.opacity(0.28), radius: 6, x: 0, y: 3)
                }
            }
        }
        .disabled(sent || sending)
    }

    private var labelText: String {
        if sent { return languageCode == "en" ? "Sent to family" : "已发给家人" }
        if elder { return languageCode == "en" ? "Ask my family to check" : "发到家庭群，让孩子们看看" }
        return languageCode == "en" ? "Send to family" : "发到家庭群"
    }

    private func tap() {
        guard let gid = FamilyShareTarget.groupId(chat), chat.hasFamily else {
            // 未加入家庭 / IM 未就绪：提示后跳家庭 Tab（2026-10-14 真机：原来只跳不提示，用户不知道为什么跳过去了）
            FamilyShareTarget.showNotReadyHint(languageCode: languageCode)
            router.pendingTabIndex = 2
            return
        }
        sending = true
        Task {
            let ok = await FamilyShareTarget.send(chat, gid: gid) { target in
                await chat.sendHelpRequest(
                    groupId: target, title: title, summary: summary,
                    riskLevel: normalizedRisk, refType: "conversation", refId: conversationId
                )
            }
            sending = false
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
