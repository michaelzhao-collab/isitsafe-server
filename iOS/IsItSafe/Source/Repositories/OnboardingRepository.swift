//
//  OnboardingRepository.swift
//  IsItSafe
//
//  V4-P1 拉冷启动 chips；24h 本地缓存 + 网络失败回落到硬编码兜底
//

import Foundation

public final class OnboardingRepository {
    public static let shared = OnboardingRepository()
    private let network = NetworkManager.shared
    private let ttl: TimeInterval = 24 * 3600 // 24h

    private init() {}

    // 缓存 key 必须按 language 分桶，否则切语言时返回旧语言的 chips
    // 历史版本用过 "isitsafe.onboarding.chips.cache" 这个共享 key，
    // 启动时一次性清掉避免污染（不影响功能，下次 fetch 会重新拉）
    private func cacheKey(language: String) -> String {
        "isitsafe.onboarding.chips.cache.\(language)"
    }
    private func cacheTimestampKey(language: String) -> String {
        "isitsafe.onboarding.chips.cachedAt.\(language)"
    }
    private static let legacyCacheKey = "isitsafe.onboarding.chips.cache"
    private static let legacyTimestampKey = "isitsafe.onboarding.chips.cachedAt"

    /// 拉取（命中缓存优先，否则请求并缓存）
    public func fetch(languageCode: String) async -> [OnboardingChip] {
        clearLegacyCacheIfNeeded()
        if let cached = readCacheIfFresh(language: languageCode) { return cached }
        do {
            let chips: [OnboardingChip] = try await network.request(
                endpoint: .onboardingChips(language: languageCode)
            )
            writeCache(chips, language: languageCode)
            return chips
        } catch {
            // 缓存过期但还在 → 用过期缓存而非硬编码（用户体验稍好）
            if let stale = readCacheAny(language: languageCode) { return stale }
            return FallbackOnboardingChips.defaults(languageCode: languageCode)
        }
    }

    private func readCacheIfFresh(language: String) -> [OnboardingChip]? {
        let ts = UserDefaults.standard.double(forKey: cacheTimestampKey(language: language))
        guard ts > 0, Date().timeIntervalSince1970 - ts < ttl else { return nil }
        return readCacheAny(language: language)
    }

    private func readCacheAny(language: String) -> [OnboardingChip]? {
        guard let data = UserDefaults.standard.data(forKey: cacheKey(language: language)) else { return nil }
        return try? JSONDecoder().decode([OnboardingChip].self, from: data)
    }

    private func writeCache(_ chips: [OnboardingChip], language: String) {
        if let data = try? JSONEncoder().encode(chips) {
            UserDefaults.standard.set(data, forKey: cacheKey(language: language))
            UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: cacheTimestampKey(language: language))
        }
    }

    /// 清掉旧版本的不分语言缓存（一次性）
    private func clearLegacyCacheIfNeeded() {
        let defaults = UserDefaults.standard
        if defaults.data(forKey: Self.legacyCacheKey) != nil {
            defaults.removeObject(forKey: Self.legacyCacheKey)
            defaults.removeObject(forKey: Self.legacyTimestampKey)
        }
    }
}
