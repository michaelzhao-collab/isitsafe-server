//
//  AnalyzingDotsView.swift
//  IsItSafe
//
//  分析中状态：6 个点循环动画 + 根据耗时渐进更新提示文案。
//  iOS 端只发一次 /api/ai/analyze 整段调用（服务端完成 RAG+AI），无独立阶段，
//  因此用「耗时阶段」给出更诚实的反馈，避免编造"风险库查询/AI 分析"两阶段。
//

import Combine
import SwiftUI
import UIKit

public struct AnalyzingDotsView: View {
    @State private var dotCount = 0
    @State private var elapsedSeconds: Int = 0
    private let totalDots = 6
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"

    public init() {}

    public var body: some View {
        HStack(spacing: 4) {
            Text(stageMessage)
                .font(.subheadline)
                .foregroundColor(AppTheme.textPrimary)
            HStack(spacing: 2) {
                ForEach(0..<totalDots, id: \.self) { i in
                    Circle()
                        .fill(i <= dotCount ? AppTheme.primary : Color(UIColor.tertiaryLabel))
                        .frame(width: 4, height: 4)
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(AppTheme.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .onReceive(Timer.publish(every: 0.4, on: .main, in: .common).autoconnect()) { _ in
            dotCount = (dotCount + 1) % (totalDots + 1)
        }
        // 1s 精度计时器：用于渐进文案；阶段切换点 4s / 10s / 20s
        .onReceive(Timer.publish(every: 1, on: .main, in: .common).autoconnect()) { _ in
            elapsedSeconds += 1
        }
        .accessibilityLabel(stageMessage)
    }

    private var stageMessage: String {
        switch elapsedSeconds {
        case 0..<4:
            return languageCode == "en" ? "Thinking" : "正在思考中"
        case 4..<10:
            return languageCode == "en" ? "AI is analyzing" : "AI 正在分析"
        case 10..<20:
            return languageCode == "en" ? "Still working, please wait" : "正在深入分析，请稍候"
        default:
            return languageCode == "en" ? "AI is busy, hang tight" : "AI 较繁忙，请耐心等待"
        }
    }
}
