//
//  CardMessageView.swift
//  IsItSafe
//
//  V5.1 家庭群系统卡片渲染（T2-2）。一套组件渲染 5 类 cardType，按角色取按钮。
//  未知 cardType/version 降级为纯文本 + 标题（payload 带 v 字段）。
//

import SwiftUI

public struct CardMessageView: View {
    let message: ChatMessage
    let groupId: String
    /// userId → 成员（解析"打电话给X"称呼、判断我是不是发起人）
    let membersById: [String: FamilyMember]
    let isElder: Bool
    let scale: (CGFloat) -> CGFloat

    // 只订阅 isSpeaking：TTSService.progress 每个字都在变，@ObservedObject 会让群里所有卡片
    // 随朗读进度逐字重绘（LazyVStack 全量重排，实测出现过主线程卡死）。
    @State private var ttsSpeaking = TTSService.shared.isSpeaking
    private var tts: TTSService { TTSService.shared }
    @ObservedObject private var chat = FamilyChatCoordinator.shared

    private var payload: ChatPayload? { message.payload }
    private var cardType: String { payload?.string("cardType") ?? "" }
    private var title: String { payload?.string("title") ?? message.content ?? "" }
    private var summary: String { payload?.string("summary") ?? "" }
    private var riskLevel: String { payload?.string("riskLevel") ?? "none" }
    private var eventId: String? { payload?.string("eventId") }
    private var actorUserId: String? { payload?.string("actorUserId") }
    private var handleStatus: String? { payload?.string("handleStatus") }
    private var handledByName: String? { payload?.string("handledByName") }

    private var myUserId: String? { TokenStore.shared.userId }
    private var isActor: Bool { actorUserId != nil && actorUserId == myUserId }

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Rectangle().fill(stripeColor).frame(height: 4)
            VStack(alignment: .leading, spacing: 8) {
                tagLabel
                Text(title)
                    .font(.system(size: scale(isElder ? 21 : 17), weight: .semibold))
                    .foregroundColor(AppTheme.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)
                if !summary.isEmpty {
                    Text(summary)
                        .font(.system(size: scale(isElder ? 17 : 14)))
                        .foregroundColor(AppTheme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if let status = handleStatus { handledBanner(status) }
                actionButton
                if cardType == "help_request" && handleStatus == nil && !isActor {
                    chipsRow    // 子女端对 open 求助卡显示 chips
                }
            }
            .padding(12)
        }
        .background(RoundedRectangle(cornerRadius: 14).fill(AppTheme.cardBackground))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(stripeColor.opacity(0.25), lineWidth: 1))
        .onReceive(TTSService.shared.$isSpeaking) { ttsSpeaking = $0 }
    }

    // MARK: - 标签 / 颜色

    private var stripeColor: Color {
        switch riskLevel {
        case "high": return AppTheme.riskHigh
        case "medium": return Color(hex: "F59E0B")
        case "low": return AppTheme.riskLow
        default: return AppTheme.primary
        }
    }

    private var tagLabel: some View {
        let (icon, text) = tagContent
        return HStack(spacing: 5) {
            Text(icon)
            Text(text).font(.system(size: scale(12), weight: .semibold))
        }
        .foregroundColor(stripeColor)
        .padding(.horizontal, 8).padding(.vertical, 2)
        .background(Capsule().fill(stripeColor.opacity(0.12)))
    }

    private var tagContent: (String, String) {
        switch cardType {
        case "help_request": return ("🙋", isActor ? loc("我的求助", "My request") : loc("想问问大家", "Asking the family"))
        case "risk_alert": return ("⚠️", loc("高风险提醒", "High risk alert"))
        case "case_share": return ("📋", (payload?.string("sharerName")).map { "\($0) " + loc("分享的案例", "shared a case") } ?? loc("案例", "Case"))
        case "daily_scam": return ("🗞", loc("每日一骗", "Daily scam"))
        case "milestone": return ("🏅", loc("守护里程碑", "Milestone"))
        default: return ("📢", loc("官方消息", "Official"))
        }
    }

    // MARK: - 处置横幅

    private func handledBanner(_ status: String) -> some View {
        let who = handledByName ?? loc("家人", "Family")
        let (text, color): (String, Color)
        switch status {
        case "dismissed": (text, color) = ("✓ " + loc("已确认：危险，别信 —— ", "Confirmed dangerous — ") + who, AppTheme.riskHigh)
        case "confirmed_safe": (text, color) = ("✓ " + loc("已确认没事 —— ", "Confirmed safe — ") + who, AppTheme.riskLow)
        case "checking": (text, color) = ("👀 " + who + loc(" 正在看", " is checking"), AppTheme.primary)
        case "acknowledged": (text, color) = ("✓ " + loc("已收到", "Acknowledged"), AppTheme.riskLow)
        default: (text, color) = (status, AppTheme.textSecondary)
        }
        return Text(text)
            .font(.system(size: scale(isElder ? 16 : 13), weight: .semibold))
            .foregroundColor(color)
            .padding(.horizontal, 10).padding(.vertical, 8)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 10).fill(color.opacity(0.1)))
    }

    // MARK: - 角色按钮

    @ViewBuilder
    private var actionButton: some View {
        switch cardType {
        case "risk_alert":
            if isElder || isActor { ttsButton } else { callButton }
        case "case_share":
            if isElder { ttsButton } else { remindButton }
        case "daily_scam":
            if isElder { ttsButton } else { forwardButton }
        case "milestone":
            if !isElder { posterButton }
        default:
            EmptyView()   // help_request 无默认按钮（整卡可点 + chips）
        }
    }

    private var ttsButton: some View {
        Button {
            if ttsSpeaking { tts.stop() }
            // 2026-09-07 复核：不传 language 时 TTSService 按设备系统语言选音色，
            // 系统语言为英文的华人老人会用 en-US 音色读中文卡片，基本读不出来。
            // 这里显式传 App 内语言设置。
            else { tts.speak(title + "。" + summary, language: appLanguage) }
        } label: {
            cardButtonLabel(icon: "speaker.wave.2.fill",
                            text: ttsSpeaking ? loc("停止", "Stop") : loc("听 AI 讲", "Listen"),
                            filled: true, color: stripeColor)
        }
    }

    /// 播报卡发起人（可能已退群 → nil）
    private var actorMember: FamilyMember? { actorUserId.flatMap { membersById[$0] } }

    /// 2026-09-07 复核：发起人退群后 membersById 取不到，原来文案会变成"打电话给 "且点击无动作。
    /// 现在只有拿得到成员且有号码时才显示按钮，否则降级为 TTS（老人/本人路径已有 TTS，这里给子女）。
    @ViewBuilder
    private var callButton: some View {
        if let member = actorMember, let phone = member.phone, !phone.isEmpty {
            Button {
                if let url = URL(string: "tel://\(phone)") { UIApplication.shared.open(url) }
            } label: {
                cardButtonLabel(icon: "phone.fill",
                                text: loc("打电话给", "Call ") + member.effectiveName,
                                filled: true, color: AppTheme.riskHigh)
            }
        } else {
            ttsButton
        }
    }

    private var remindButton: some View {
        Button {
            // 定向提醒：发一条 @提醒 语义的普通消息（简化）
            Task { await chat.send(groupId: groupId, type: .text, content: loc("提醒大家看看上面这条案例", "Please read the case above")) }
        } label: {
            cardButtonLabel(icon: "bell.fill", text: loc("提醒 TA 看", "Remind"), filled: false, color: AppTheme.primary)
        }
    }

    private var forwardButton: some View {
        Button {
            Self.presentShareSheet(items: [title + "\n" + summary])
        } label: {
            cardButtonLabel(icon: "square.and.arrow.up", text: loc("转发给朋友", "Forward"), filled: false, color: AppTheme.primary)
        }
    }

    private var posterButton: some View {
        Button {
            Self.presentShareSheet(items: [title])
        } label: {
            cardButtonLabel(icon: "photo.on.rectangle", text: loc("生成分享海报", "Share poster"), filled: false, color: AppTheme.primary)
        }
    }

    /// 2026-09-07 复核：原来直接 present UIActivityViewController，没设 popover 锚点。
    /// 工程 TARGETED_DEVICE_FAMILY = "1,2" 支持 iPad，iPad 上分享面板以 popover 呈现，
    /// 缺 sourceView/sourceRect 会让 UIKit 抛异常直接崩溃。这里统一补锚点（居中）。
    static func presentShareSheet(items: [Any]) {
        guard let top = UIApplication.shared.topController else { return }
        let av = UIActivityViewController(activityItems: items, applicationActivities: nil)
        if let pop = av.popoverPresentationController {
            pop.sourceView = top.view
            pop.sourceRect = CGRect(x: top.view.bounds.midX, y: top.view.bounds.midY, width: 0, height: 0)
            pop.permittedArrowDirections = []   // 居中弹出，不画箭头
        }
        top.present(av, animated: true)
    }

    private func cardButtonLabel(icon: String, text: String, filled: Bool, color: Color) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
            Text(text).font(.system(size: scale(isElder ? 19 : 16), weight: .bold))
        }
        .foregroundColor(filled ? .white : color)
        .frame(maxWidth: .infinity)
        .frame(height: scale(isElder ? 54 : 46))
        .background(RoundedRectangle(cornerRadius: 12).fill(filled ? color : color.opacity(0.12)))
    }

    // MARK: - chips（子女端处置求助）

    private var chipsRow: some View {
        HStack(spacing: 8) {
            chip(loc("别信❗", "Don't trust"), color: AppTheme.riskHigh, action: "dismissed",
                 preset: loc("别信❗", "Don't trust it"))
            chip(loc("没事✅", "It's fine"), color: AppTheme.riskLow, action: "confirmed_safe",
                 preset: loc("没事，放心", "It's fine, don't worry"))
            chip(loc("我看看", "Checking"), color: AppTheme.textSecondary, action: "checking",
                 preset: loc("我看看", "Let me check"))
        }
    }

    private func chip(_ text: String, color: Color, action: String, preset: String) -> some View {
        Button {
            guard let eid = eventId else { return }
            Task { await chat.handleEvent(eventId: eid, groupId: groupId, action: action, presetText: preset) }
        } label: {
            Text(text)
                .font(.system(size: scale(15), weight: .semibold))
                .foregroundColor(color)
                .frame(maxWidth: .infinity)
                .frame(height: scale(40))
                .background(RoundedRectangle(cornerRadius: 20).stroke(color.opacity(0.5), lineWidth: 1.5))
        }
    }

    private func loc(_ zh: String, _ en: String) -> String {
        appLanguage == "en" ? en : zh
    }

    /// App 内语言设置（不是设备系统语言）
    private var appLanguage: String {
        UserDefaults.standard.string(forKey: "isitsafe.language") ?? "zh"
    }
}

extension UIApplication {
    var topController: UIViewController? {
        guard let scene = connectedScenes.first as? UIWindowScene,
              let root = scene.windows.first(where: { $0.isKeyWindow })?.rootViewController else { return nil }
        var top = root
        while let presented = top.presentedViewController { top = presented }
        return top
    }
}
