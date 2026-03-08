//
//  LocalCacheStore.swift
//  IsItSafe
//

import Foundation

public final class LocalCacheStore {
    public static let shared = LocalCacheStore()
    private let lastAnalysisKey = "isitsafe.lastAnalysis"
    private let knowledgeListKey = "isitsafe.knowledgeList"

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
}
