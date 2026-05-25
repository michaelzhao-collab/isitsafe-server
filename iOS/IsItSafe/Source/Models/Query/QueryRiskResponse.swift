//
//  QueryRiskResponse.swift
//  IsItSafe
//  POST /api/query/phone | url | company 返回
//

import Foundation

public struct QueryRiskResponse: Codable {
    public let riskLevel: String?
    public let tags: [String]?
    public let records: [RiskDataRecord]?
}

public struct RiskDataRecord: Codable {
    public let id: String?
    public let type: String?
    public let content: String?
    public let riskLevel: String?
    public let riskCategory: String?
    public let tags: [String]?
    public let source: String?
    public let evidence: String?
    public let createdAt: String?
    public let updatedAt: String?
}
