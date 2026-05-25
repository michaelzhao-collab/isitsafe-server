//
//  KnowledgeCacheStore.swift
//  IsItSafe
//
//  防诈案例列表本地缓存：按 category+search 缓存首页，进入页面先展示缓存再同步服务端。
//

import Foundation

public final class KnowledgeCacheStore {
    public static let shared = KnowledgeCacheStore()
    private let prefix = "isitsafe.knowledge.cache"
    private let defaults = UserDefaults.standard

    private init() {}

    private func key(category: String?, search: String?) -> String {
        "\(prefix).\(category ?? "all").\(search ?? "")"
    }

    public func load(category: String?, search: String?) -> (items: [KnowledgeItem], total: Int)? {
        let k = key(category: category, search: search)
        guard let data = defaults.data(forKey: k),
              let decoded = try? JSONDecoder().decode(CacheEntry.self, from: data) else { return nil }
        return (decoded.items, decoded.total)
    }

    public func save(category: String?, search: String?, items: [KnowledgeItem], total: Int) {
        let k = key(category: category, search: search)
        let entry = CacheEntry(items: items, total: total)
        if let data = try? JSONEncoder().encode(entry) {
            defaults.set(data, forKey: k)
        }
    }

    private func detailKey(id: String) -> String {
        "\(prefix).detail.\(id)"
    }

    /// 案例详情缓存：按 id 存储，进入详情页先展示缓存再请求最新
    public func loadDetail(id: String) -> KnowledgeItem? {
        let k = detailKey(id: id)
        guard let data = defaults.data(forKey: k),
              let item = try? JSONDecoder().decode(KnowledgeItem.self, from: data) else { return nil }
        return item
    }

    public func saveDetail(id: String, item: KnowledgeItem) {
        let k = detailKey(id: id)
        if let data = try? JSONEncoder().encode(item) {
            defaults.set(data, forKey: k)
        }
    }

    private struct CacheEntry: Codable {
        let items: [KnowledgeItem]
        let total: Int
    }
}
