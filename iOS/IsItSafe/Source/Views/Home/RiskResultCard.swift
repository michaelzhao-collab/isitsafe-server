//
//  RiskResultCard.swift
//  IsItSafe
//

import SwiftUI
import UIKit

public struct RiskResultCard: View {
    public let data: RiskAnalysisViewData
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"

    /// 用户原问题（发到家庭群时让家人知道问的是什么）；截图提问传「[截图]」+ 文字
    public var question: String? = nil

    public init(data: RiskAnalysisViewData, question: String? = nil) {
        self.data = data
        self.question = question
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
            .background(AppTheme.riskGradient(data.riskLevel))

            VStack(alignment: .leading, spacing: 12) {
                Text(data.summary)
                    .font(.body)
                    .multilineTextAlignment(.leading)
                    .lineLimit(nil)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .fixedSize(horizontal: false, vertical: true)
                if !data.reasons.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        Text(languageCode == "en" ? "Reasons" : "原因")
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .foregroundColor(AppTheme.riskSectionTitle(data.riskLevel))
                        ForEach(Array(data.reasons.enumerated()), id: \.offset) { i, r in
                            Text("\(i + 1). \(RiskResultCard.ensureEndsWithPeriod(r))")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                                .lineLimit(nil)
                                .multilineTextAlignment(.leading)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
                if !data.advice.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        Text(languageCode == "en" ? "Advice" : "建议")
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .foregroundColor(AppTheme.riskSectionTitle(data.riskLevel))
                        ForEach(Array(data.advice.enumerated()), id: \.offset) { i, a in
                            Text("\(i + 1). \(RiskResultCard.ensureEndsWithPeriod(a))")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                                .lineLimit(nil)
                                .multilineTextAlignment(.leading)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }

                // V5.1 求助闭环：把这条 AI 结论发到家庭群，让家人把关
                // 2026-10-07：标题用 summary；verdict 是 'scam'|'safe'|'unknown' 英文枚举，历史数据回放时会把 "safe" 直接当标题发到家庭群
                ShareToFamilyButton(
                    title: data.summary,
                    summary: data.summary,
                    riskLevel: data.riskLevel,
                    conversationId: data.conversationId,
                    elder: ElderModeService.shared.isEnabled,
                    question: question,
                    score: data.score,
                    reasons: data.reasons,
                    advice: data.advice
                )
                .padding(.top, 4)
            }
            .padding(16)
            // 2026-10-14 配色 V2：正文整卡带等级浅底（原来白卡只有标题条有颜色）
            .background(AppTheme.riskSoft(data.riskLevel))
        }
        .background(AppTheme.cardBackground)
        // 限制回复卡片最大宽度，形成"左侧回复一列"的两人对话结构
        .frame(maxWidth: 300, alignment: .leading)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .shadow(color: riskColor.opacity(0.18), radius: 10, x: 0, y: 5)
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
        case "medium", "mid":
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
        case "medium", "mid": return AppTheme.riskMedium
        case "low": return AppTheme.riskLow
        default: return AppTheme.riskUnknown
        }
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
