//
//  AIService.swift
//  IsItSafe
//

import Foundation

public final class AIService {
    public static let shared = AIService()
    private let repo = AIRepository.shared
    private let cache = LocalCacheStore.shared
    private let recent = RecentSearchStore.shared

    private init() {}

    public func analyzeText(content: String, language: String? = "zh", country: String? = nil) async throws -> RiskAnalysisViewData {
        let req = RiskAnalysisRequest(content: content, language: language, country: country)
        let result = try await repo.analyze(req)
        cache.lastAnalysisResult = result
        recent.add(content)
        return RiskAnalysisViewData(from: result)
    }

    public func analyzeScreenshot(content: String, language: String? = "zh", imageUrl: String? = nil) async throws -> RiskAnalysisViewData {
        let req = ScreenshotAnalyzeRequest(content: content, language: language, isScreenshot: true, imageUrl: imageUrl)
        let result = try await repo.analyzeScreenshot(req)
        cache.lastAnalysisResult = result
        return RiskAnalysisViewData(from: result)
    }
}
