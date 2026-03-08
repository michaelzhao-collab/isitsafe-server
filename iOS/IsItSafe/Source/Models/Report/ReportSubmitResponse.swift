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
        case id, userId, type, content, status, createdAt
        case relatedQueryId = "related_query_id"
        case handledBy = "handled_by"
        case handledAt = "handled_at"
    }
}
