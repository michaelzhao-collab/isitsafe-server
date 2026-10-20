//
//  QueryHistoryItem.swift
//  IsItSafe
//

import Foundation

public struct QueryHistoryItem: Codable, Identifiable, Hashable {
    public func hash(into hasher: inout Hasher) { hasher.combine(id) }
    public static func == (lhs: QueryHistoryItem, rhs: QueryHistoryItem) -> Bool { lhs.id == rhs.id }
    public let id: String
    /// 会话 id，同对话内多条消息共用；列表按会话聚合时与 id 一致
    public let conversationId: String?
    public let userId: String?
    public let inputType: String
    public let content: String
    public let resultJson: RiskAnalysisResult?
    public let riskLevel: String?
    public let confidence: Int?
    public let aiProvider: String?
    public let createdAt: String?
    /// 用户上传的截图/图片 CDN 地址，历史详情与对话中展示用
    public let imageUrl: String?

    enum CodingKeys: String, CodingKey {
        case id
        // 2026-10-20 复核修复：NetworkManager 用 .convertFromSnakeCase，服务端返回 camelCase 的 conversationId，
        // 原来写死 "conversation_id" 在两种情况下都匹配不上 → 恒 nil → 删除历史走错接口、刷新后复活
        case conversationId
        case userId
        case content
        case createdAt
        case confidence
        case inputType
        case resultJson
        case riskLevel
        case aiProvider
        case imageUrl
    }
}
