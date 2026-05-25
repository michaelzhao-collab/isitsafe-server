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
    /// 网络异常时降级到本地缓存；首次成功后会写缓存
    public func fetchHistoryByConversation(conversationId: String) async throws -> [QueryHistoryItem] {
        do {
            let res = try await repo.history(page: 1, pageSize: 100, riskLevel: nil, conversationId: conversationId)
            // 写缓存供下次离线/弱网降级
            LocalCacheStore.shared.cacheConversationMessages(res.items, conversationId: conversationId)
            return res.items
        } catch {
            // 仅对网络类错误降级；其他错误（401/403/解析失败等）继续抛出
            if Self.isNetworkError(error),
               let cached = LocalCacheStore.shared.cachedConversationMessages(conversationId: conversationId),
               !cached.isEmpty {
                return cached
            }
            throw error
        }
    }

    private static func isNetworkError(_ error: Error) -> Bool {
        if let api = error as? APIError {
            switch api {
            case .networkError, .timeout: return true
            default: return false
            }
        }
        return false
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
