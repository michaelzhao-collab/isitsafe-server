//
//  QueryHistoryItem.swift
//  IsItSafe
//

import Foundation

public struct QueryHistoryItem: Codable, Identifiable, Hashable {
    public func hash(into hasher: inout Hasher) { hasher.combine(id) }
    public static func == (lhs: QueryHistoryItem, rhs: QueryHistoryItem) -> Bool { lhs.id == rhs.id }
    public let id: String
    public let userId: String?
    public let inputType: String
    public let content: String
    public let resultJson: RiskAnalysisResult?
    public let riskLevel: String?
    public let confidence: Int?
    public let aiProvider: String?
    public let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, userId, content, createdAt
        case inputType = "input_type"
        case resultJson = "result_json"
        case riskLevel = "risk_level"
        case aiProvider = "ai_provider"
        case confidence
    }
}
