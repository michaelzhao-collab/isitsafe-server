//
//  RiskResultCard.swift
//  IsItSafe
//

import SwiftUI
import UIKit

public struct RiskResultCard: View {
    public let data: RiskAnalysisViewData
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"

    public init(data: RiskAnalysisViewData) {
        self.data = data
    }

    public var body: some View {
        VStack(spacing: 0) {
            // 头部风险等级条：背景颜色随风险变化，高风险时文字改为白色
            HStack {
                Text(localizedRiskLevel)
                    .font(.headline)
                    .foregroundColor(headerTextColor)
                Spacer()
                if let score = data.score {
                    Text(scoreLabel(for: score))
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(headerTextColor)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(headerBackground)

            VStack(alignment: .leading, spacing: 12) {
                Text(data.summary)
                    .font(.body)
                    .multilineTextAlignment(.leading)
                if !data.reasons.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        Text(languageCode == "en" ? "Reasons" : "原因")
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .foregroundColor(.primary)
                        ForEach(Array(data.reasons.enumerated()), id: \.offset) { i, r in
                            Text("\(i + 1). \(RiskResultCard.ensureEndsWithPeriod(r))")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }
                    }
                }
                if !data.advice.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        Text(languageCode == "en" ? "Advice" : "建议")
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .foregroundColor(.primary)
                        ForEach(Array(data.advice.enumerated()), id: \.offset) { i, a in
                            Text("\(i + 1). \(RiskResultCard.ensureEndsWithPeriod(a))")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }
                    }
                }
            }
            .padding(16)
        }
        .background(AppTheme.cardBackground)
        // 限制回复卡片最大宽度，形成"左侧回复一列"的两人对话结构
        .frame(maxWidth: 300, alignment: .leading)
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.05), radius: 4, x: 0, y: 2)
        .contextMenu {
            Button {
                UIPasteboard.general.string = copyableText
            } label: {
                Label(languageCode == "en" ? "Copy" : "复制", systemImage: "doc.on.doc")
            }
        }
    }

    /// 根据当前语言返回本地化的风险等级文案
    private var localizedRiskLevel: String {
        switch data.riskLevel.lowercased() {
        case "high":
            return languageCode == "en" ? "High risk" : "高风险"
        case "medium":
            return languageCode == "en" ? "Medium risk" : "中风险"
        case "low":
            return languageCode == "en" ? "Low risk" : "低风险"
        default:
            return languageCode == "en" ? "Unknown" : "未知"
        }
    }

    /// 根据当前语言返回「得分 / Score」前缀
    private func scoreLabel(for score: Int) -> String {
        languageCode == "en" ? "Score \(score)" : "得分 \(score)"
    }

    private var riskColor: Color {
        switch data.riskLevel.lowercased() {
        case "high": return AppTheme.riskHigh
        case "medium": return AppTheme.riskMedium
        case "low": return AppTheme.riskLow
        default: return AppTheme.riskUnknown
        }
    }

    /// 头部背景颜色：不同风险等级使用不同颜色
    private var headerBackground: Color {
        riskColor
    }

    /// 头部文字颜色：统一使用白色，保证对比度
    private var headerTextColor: Color {
        .white
    }

    /// 长按复制时的纯文本内容
    private var copyableText: String {
        let isEn = languageCode == "en"
        var lines: [String] = [localizedRiskLevel, data.summary]
        if !data.reasons.isEmpty {
            lines.append(isEn ? "Reasons:" : "原因：")
            lines += data.reasons.enumerated().map { "\($0.offset + 1). \($0.element)" }
        }
        if !data.advice.isEmpty {
            lines.append(isEn ? "Advice:" : "建议：")
            lines += data.advice.enumerated().map { "\($0.offset + 1). \($0.element)" }
        }
        return lines.joined(separator: "\n")
    }

    /// 保证原因/建议句末有句号
    private static func ensureEndsWithPeriod(_ s: String) -> String {
        let t = s.trimmingCharacters(in: .whitespaces)
        if t.isEmpty { return t }
        if t.hasSuffix("。") || t.hasSuffix(".") { return s }
        return s + "。"
    }
}
