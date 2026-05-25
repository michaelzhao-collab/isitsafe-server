//
//  RiskAnalysisViewData.swift
//  IsItSafe
//
//  用于 UI 展示的转换结构。
//

import Foundation

public struct RiskAnalysisViewData {
    public let riskLevel: String
    public let confidence: Int
    public let riskType: [String]
    public let summary: String
    public let reasons: [String]
    public let advice: [String]
    public let score: Int?
    /// 当前对话 id，同对话内下次提问时传回
    public let conversationId: String?
    /// true 表示追问/闲聊回复，只展示 summary 文字气泡，不显示风险卡片
    public let isConversational: Bool

    public init(from result: RiskAnalysisResult) {
        riskLevel = result.riskLevel ?? "unknown"
        confidence = result.confidence ?? 0
        riskType = result.riskType ?? []
        summary = result.summary ?? ""
        reasons = result.reasons ?? []
        advice = result.advice ?? []
        score = result.score
        conversationId = result.conversationId
        isConversational = result.isConversational ?? false
    }

    /// 图片中未识别到文字时，展示与正常分析一致的卡片，不报错
    public static let imageContentNotRecognized: RiskAnalysisViewData = {
        RiskAnalysisViewData(
            riskLevel: "unknown",
            confidence: 0,
            riskType: ["未知风险"],
            summary: "图片内容无法识别",
            reasons: [
                "图片中未识别到可分析文字",
                "当前无法对纯图片内容进行风险分析",
                "可尝试上传包含文字的截图或直接输入文字",
            ],
            advice: [
                "请上传包含文字的图片以便分析",
                "或直接输入您要检测的文字内容",
                "如有疑问可联系客服",
            ],
            score: nil,
            conversationId: nil
        )
    }()

    public init(riskLevel: String, confidence: Int, riskType: [String], summary: String, reasons: [String], advice: [String], score: Int?, conversationId: String? = nil, isConversational: Bool = false) {
        self.riskLevel = riskLevel
        self.confidence = confidence
        self.riskType = riskType
        self.summary = summary
        self.reasons = reasons
        self.advice = advice
        self.score = score
        self.conversationId = conversationId
        self.isConversational = isConversational
    }

    public var riskLevelDisplay: String {
        // 直接使用服务端返回的 riskLevel 字段（如 high/medium/low/unknown），
        // 具体展示文案交给 UI 层根据 languageCode 再做本地化。
        return riskLevel
    }
}

