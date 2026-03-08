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

    public init(from result: RiskAnalysisResult) {
        riskLevel = result.riskLevel
        confidence = result.confidence
        riskType = result.riskType
        summary = result.summary
        reasons = result.reasons
        advice = result.advice
        score = result.score
    }

    public var riskLevelDisplay: String {
        switch riskLevel.lowercased() {
        case "high": return "高风险"
        case "medium": return "中风险"
        case "low": return "低风险"
        case "unknown": return "未知"
        default: return riskLevel
        }
    }
}
