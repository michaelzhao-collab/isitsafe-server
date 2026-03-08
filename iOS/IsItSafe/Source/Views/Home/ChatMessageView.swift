//
//  ChatMessageView.swift
//  IsItSafe
//
//  单条对话：右侧用户内容 + 右侧「正在分析中......」或左侧回复内容。
//

import SwiftUI

public struct ChatMessageView: View {
    public let turn: ChatTurn

    public init(turn: ChatTurn) {
        self.turn = turn
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // 右侧：用户发送的内容（文案 / 图片 / 链接等）
            if turn.userText != nil || turn.userImage != nil {
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
        .padding(.horizontal, 16)
        .padding(.vertical, 6)
    }

    private var userBubble: some View {
        let hasImage = turn.userImage != nil
        let hasText = turn.userText.map { !$0.isEmpty } ?? false
        let imageOnTopTextBelow = hasImage && hasText

        return Group {
            if imageOnTopTextBelow {
                VStack(alignment: .leading, spacing: 8) {
                    if let img = turn.userImage {
                        Image(uiImage: img)
                            .resizable()
                            .scaledToFit()
                            .frame(maxWidth: 200, maxHeight: 160)
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                    if let text = turn.userText, !text.isEmpty {
                        Text(text)
                            .font(.subheadline)
                            .foregroundColor(.primary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .padding(12)
                .background(AppTheme.primary.opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .frame(maxWidth: .infinity, alignment: .trailing)
            } else {
                VStack(alignment: hasImage ? .leading : .trailing, spacing: 6) {
                    if let img = turn.userImage {
                        Image(uiImage: img)
                            .resizable()
                            .scaledToFit()
                            .frame(maxWidth: 200, maxHeight: 160)
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                    if let text = turn.userText, !text.isEmpty {
                        Text(text)
                            .font(.subheadline)
                            .foregroundColor(.primary)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .background(AppTheme.primary.opacity(0.12))
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }
                }
                .frame(maxWidth: .infinity, alignment: .trailing)
            }
        }
    }

    @ViewBuilder
    private func replyBubble(result: ChatTurnResult) -> some View {
        Group {
            switch result {
            case .analysis(let data):
                RiskResultCard(data: data)
            case .query(let response):
                QueryRiskCard(response: response)
            case .failure(let message):
                Text(message)
                    .font(.subheadline)
                    .foregroundColor(.red)
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.red.opacity(0.08))
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
