//
//  ReportSubmitResponse.swift
//  IsItSafe
//

import Foundation

public struct ReportSubmitResponse: Codable {
    public let id: String
    public let userId: String?
    public let type: String
    public let content: String
    public let status: String
    public let relatedQueryId: String?
    public let handledBy: String?
    public let handledAt: String?
    public let createdAt: String?

    enum CodingKeys: String, CodingKey {
        // 2026-10-20：NetworkManager 用 .convertFromSnakeCase，显式 snake key 永远匹配不上
        case id, userId, type, content, status, createdAt
        case relatedQueryId, handledBy, handledAt
    }
}
