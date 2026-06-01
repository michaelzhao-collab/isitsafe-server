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
    private let cacheKey = "isitsafe.onboarding.chips.cache"
    private let cacheTimestampKey = "isitsafe.onboarding.chips.cachedAt"
    private let ttl: TimeInterval = 24 * 3600 // 24h

    private init() {}

    /// 拉取（命中缓存优先，否则请求并缓存）
    public func fetch(languageCode: String) async -> [OnboardingChip] {
        if let cached = readCacheIfFresh() { return cached }
        do {
            let chips: [OnboardingChip] = try await network.request(
                endpoint: .onboardingChips(language: languageCode)
            )
            writeCache(chips)
            return chips
        } catch {
            // 缓存过期但还在 → 用过期缓存而非硬编码（用户体验稍好）
            if let stale = readCacheAny() { return stale }
            return FallbackOnboardingChips.defaults(languageCode: languageCode)
        }
    }

    private func readCacheIfFresh() -> [OnboardingChip]? {
        let ts = UserDefaults.standard.double(forKey: cacheTimestampKey)
        guard ts > 0, Date().timeIntervalSince1970 - ts < ttl else { return nil }
        return readCacheAny()
    }

    private func readCacheAny() -> [OnboardingChip]? {
        guard let data = UserDefaults.standard.data(forKey: cacheKey) else { return nil }
        return try? JSONDecoder().decode([OnboardingChip].self, from: data)
    }

    private func writeCache(_ chips: [OnboardingChip]) {
        if let data = try? JSONEncoder().encode(chips) {
            UserDefaults.standard.set(data, forKey: cacheKey)
            UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: cacheTimestampKey)
        }
    }
}
