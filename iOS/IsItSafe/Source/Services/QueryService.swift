//
//  QueryService.swift
//  IsItSafe
//

import Foundation

public final class QueryService {
    public static let shared = QueryService()
    private let repo = QueryRepository.shared
    private let recent = RecentSearchStore.shared

    private init() {}

    public func queryPhone(_ content: String) async throws -> QueryRiskResponse {
        recent.add(content)
        return try await repo.queryPhone(PhoneQueryRequest(content: content))
    }

    public func queryURL(_ content: String) async throws -> QueryRiskResponse {
        recent.add(content)
        return try await repo.queryURL(URLQueryRequest(content: content))
    }

    public func queryCompany(_ content: String) async throws -> QueryRiskResponse {
        recent.add(content)
        return try await repo.queryCompany(CompanyQueryRequest(content: content))
    }

    public func fetchHistory(page: Int, pageSize: Int, riskLevel: String?, conversationId: String? = nil) async throws -> QueryHistoryListResponse {
        try await repo.history(page: page, pageSize: pageSize, riskLevel: riskLevel, conversationId: conversationId)
    }

    /// 按会话拉取该对话下的所有消息（用于打开一条历史时展示多轮）
    public func fetchHistoryByConversation(conversationId: String) async throws -> [QueryHistoryItem] {
        let res = try await repo.history(page: 1, pageSize: 100, riskLevel: nil, conversationId: conversationId)
        return res.items
    }

    public func deleteHistory(id: String) async throws {
        try await repo.deleteQuery(id: id)
    }

    /// 按会话删除（列表按会话聚合后，每条记录的 id 为 conversation_id）
    public func deleteConversation(conversationId: String) async throws {
        try await repo.deleteConversation(conversationId: conversationId)
    }

    public func fetchTags() async throws -> [String] {
        try await repo.tags()
    }
}
