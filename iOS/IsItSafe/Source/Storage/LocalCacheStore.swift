//
//  LocalCacheStore.swift
//  IsItSafe
//

import Foundation

public final class LocalCacheStore {
    public static let shared = LocalCacheStore()
    private let lastAnalysisKey = "isitsafe.lastAnalysis"
    private let knowledgeListKey = "isitsafe.knowledgeList"
    private let conversationCachePrefix = "isitsafe.conv."
    /// 单个会话缓存最大数量，避免 UserDefaults 体积失控（每条消息 ~2KB）
    private let conversationMaxItems = 60

    private init() {}

    public var lastAnalysisResult: RiskAnalysisResult? {
        get {
            guard let data = UserDefaults.standard.data(forKey: lastAnalysisKey),
                  let r = try? JSONDecoder().decode(RiskAnalysisResult.self, from: data) else { return nil }
            return r
        }
        set {
            if let r = newValue, let data = try? JSONEncoder().encode(r) {
                UserDefaults.standard.set(data, forKey: lastAnalysisKey)
            } else {
                UserDefaults.standard.removeObject(forKey: lastAnalysisKey)
            }
        }
    }

    public func cacheKnowledgeList(_ list: [KnowledgeItem]) {
        if let data = try? JSONEncoder().encode(list) {
            UserDefaults.standard.set(data, forKey: knowledgeListKey)
        }
    }

    public func cachedKnowledgeList() -> [KnowledgeItem]? {
        guard let data = UserDefaults.standard.data(forKey: knowledgeListKey),
              let list = try? JSONDecoder().decode([KnowledgeItem].self, from: data) else { return nil }
        return list
    }

    // MARK: - 会话消息缓存（离线降级用，参考 #12 审计项）
    /// 缓存指定会话的消息列表；超过 conversationMaxItems 会从尾部截断
    public func cacheConversationMessages(_ items: [QueryHistoryItem], conversationId: String) {
        guard !conversationId.isEmpty else { return }
        let truncated = items.count > conversationMaxItems
            ? Array(items.prefix(conversationMaxItems))
            : items
        if let data = try? JSONEncoder().encode(truncated) {
            UserDefaults.standard.set(data, forKey: conversationCachePrefix + conversationId)
        }
    }

    /// 取出缓存；不存在返回 nil（调用方可据此决定抛错或降级展示）
    public func cachedConversationMessages(conversationId: String) -> [QueryHistoryItem]? {
        guard !conversationId.isEmpty,
              let data = UserDefaults.standard.data(forKey: conversationCachePrefix + conversationId),
              let list = try? JSONDecoder().decode([QueryHistoryItem].self, from: data) else { return nil }
        return list
    }

    public func clearConversationCache(conversationId: String) {
        UserDefaults.standard.removeObject(forKey: conversationCachePrefix + conversationId)
    }
}
