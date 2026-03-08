//
//  RiskAnalysisResult.swift
//  IsItSafe
//
//  与 server 统一 AI 返回 JSON 一致。
//

import Foundation

public struct RiskAnalysisResult: Codable {
    public let riskLevel: String
    public let confidence: Int
    public let riskType: [String]
    public let summary: String
    public let reasons: [String]
    public let advice: [String]
    public let score: Int?

    enum CodingKeys: String, CodingKey {
        case riskLevel = "risk_level"
        case confidence
        case riskType = "risk_type"
        case summary, reasons, advice, score
    }
}
