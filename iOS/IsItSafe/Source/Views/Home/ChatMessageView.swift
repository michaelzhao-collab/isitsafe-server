//
//  ChatMessageView.swift
//  IsItSafe
//
//  单条对话：右侧用户内容 + 右侧「正在分析中......」或左侧回复内容。
//

import SwiftUI

public struct ChatMessageView: View {
    public let turn: ChatTurn
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"

    public init(turn: ChatTurn) {
        self.turn = turn
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // 右侧：用户发送的内容（文案 / 图片 / 链接等）
            if turn.userText != nil || turn.userImage != nil || (turn.imageUrl != nil && !(turn.imageUrl?.isEmpty ?? true)) {
                HStack(alignment: .bottom, spacing: 0) {
                    Spacer(minLength: 48)
                    userBubble
                }
            }
            // 左侧：对方正在分析（与回复同侧，体现双方互动）
            if turn.isAnalyzing {
                HStack(alignment: .bottom, spacing: 0) {
                    AnalyzingDotsView()
                    Spacer(minLength: 48)
                }
            }
            // 左侧：服务器返回的完整回复
            if let result = turn.result {
                HStack(alignment: .top, spacing: 0) {
                    replyBubble(result: result)
                    Spacer(minLength: 48)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 16)
        .padding(.vertical, 6)
    }

    private var userBubble: some View {
        let hasImage = turn.userImage != nil || (turn.imageUrl != nil && !(turn.imageUrl?.isEmpty ?? true))
        let hasText = turn.userText.map { !$0.isEmpty } ?? false
        let imageOnTopTextBelow = hasImage && hasText

        return Group {
            if imageOnTopTextBelow {
                HStack(alignment: .bottom, spacing: 8) {
                    if let text = turn.userText, !text.isEmpty {
                        Text(text)
                            .font(.subheadline)
                            .foregroundColor(.primary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    userMessageImage
                }
                .padding(12)
                .background(AppTheme.primary.opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .frame(maxWidth: .infinity, alignment: .trailing)
            } else {
                VStack(alignment: hasImage ? .leading : .trailing, spacing: 6) {
                    userMessageImage
                    if let text = turn.userText, !text.isEmpty {
                        Text(text)
                            .font(.subheadline)
                            .foregroundColor(.primary)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .background(AppTheme.primary.opacity(0.12))
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                            .contextMenu {
                                Button {
                                    UIPasteboard.general.string = text
                                } label: {
                                    Label(languageCode == "en" ? "Copy" : "复制", systemImage: "doc.on.doc")
                                }
                            }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .trailing)
            }
        }
    }

    @ViewBuilder
    private var userMessageImage: some View {
        if let img = turn.userImage {
            Image(uiImage: img)
                .resizable()
                .scaledToFit()
                .frame(maxWidth: 200, maxHeight: 160)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        } else if let urlString = turn.imageUrl, !urlString.isEmpty {
            CachedNetworkImageView(urlString: urlString, maxWidth: 200, maxHeight: 160)
        }
    }

    @ViewBuilder
    private func replyBubble(result: ChatTurnResult) -> some View {
        Group {
            switch result {
            case .analysis(let data):
                // V3 #5：非检测意图（chat / knowledge / help）→ 文本气泡/步骤卡
                // scam_detection → 老的红黄绿风险卡
                if data.isNonDetection {
                    nonDetectionBubble(data: data)
                } else {
                    RiskResultCard(data: data)
                }
            case .query(let response):
                QueryRiskCard(response: response)
            case .failure(let message):
                if message.isEmpty {
                    EmptyView()
                } else {
                    Text(message)
                        .font(.subheadline)
                        .foregroundColor(.red)
                        .padding()
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.red.opacity(0.08))
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// V3 #5 非检测意图统一渲染：
    /// - 优先 freeText（general_chat 回答）
    /// - 否则 summary + steps（knowledge / help 列表式）
    /// - 末尾追加 actions 按钮（一键拨打、看案例库等）
    @ViewBuilder
    private func nonDetectionBubble(data: RiskAnalysisViewData) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            if let free = data.freeText, !free.isEmpty {
                Text(free)
                    .font(.subheadline)
                    .foregroundColor(AppTheme.textPrimary)
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                if !data.summary.isEmpty {
                    Text(data.summary)
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(AppTheme.textPrimary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                if !data.steps.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        ForEach(Array(data.steps.enumerated()), id: \.offset) { idx, step in
                            HStack(alignment: .top, spacing: 8) {
                                Text("\(idx + 1).")
                                    .font(.subheadline)
                                    .foregroundColor(AppTheme.textSecondary)
                                Text(step)
                                    .font(.subheadline)
                                    .foregroundColor(AppTheme.textPrimary)
                                    .multilineTextAlignment(.leading)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                        }
                    }
                } else if !data.reasons.isEmpty {
                    // 老服务端没有 steps 时回落到 reasons
                    VStack(alignment: .leading, spacing: 6) {
                        ForEach(Array(data.reasons.enumerated()), id: \.offset) { _, r in
                            Text("• \(r)")
                                .font(.subheadline)
                                .foregroundColor(AppTheme.textPrimary)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                }
            }
            if !data.actions.isEmpty {
                actionButtonsRow(actions: data.actions)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(AppTheme.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .contextMenu {
            Button {
                UIPasteboard.general.string = data.freeText ?? data.summary
            } label: {
                Label(languageCode == "en" ? "Copy" : "复制", systemImage: "doc.on.doc")
            }
        }
    }

    @ViewBuilder
    private func actionButtonsRow(actions: [RiskAnalysisResult.ResponseAction]) -> some View {
        ActionButtonsStack(actions: actions)
    }
}

/// V3 #5：动作按钮纵向堆叠（每条单独一行）
private struct ActionButtonsStack: View {
    let actions: [RiskAnalysisResult.ResponseAction]
    @EnvironmentObject private var router: AppRouter

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(actions, id: \.self) { action in
                Button {
                    handle(action: action)
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: icon(for: action.type))
                            .font(.subheadline.weight(.semibold))
                        Text(action.displayLabel)
                            .font(.subheadline.weight(.semibold))
                    }
                    .foregroundColor(AppTheme.primary)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(AppTheme.primary.opacity(0.12))
                    .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func icon(for type: String?) -> String {
        switch type {
        case "call", "call_family": return "phone.fill"
        case "knowledge": return "book.fill"
        case "report": return "exclamationmark.shield.fill"
        case "open_url": return "link"
        case "family_broadcast": return "person.2.fill"
        case "dismiss": return "checkmark"
        default: return "arrow.right.circle.fill"
        }
    }

    private func handle(action: RiskAnalysisResult.ResponseAction) {
        switch action.type {
        case "call":
            if let v = action.value,
               let url = URL(string: "tel://\(v.filter { $0.isNumber || $0 == "+" })") {
                UIApplication.shared.open(url)
            }
        case "open_url":
            if let v = action.value, let url = URL(string: v) {
                UIApplication.shared.open(url)
            }
        case "call_family", "family_broadcast":
            router.pendingTabIndex = 2 // 家庭 Tab
        case "knowledge":
            router.pendingTabIndex = 1 // 情报案例 Tab
        case "scam_check":
            // 让首页输入框获得焦点（用户可以直接键入号码）
            NotificationCenter.default.post(name: .focusHomeInput, object: nil)
        case "dismiss":
            break
        default:
            break
        }
    }
}
