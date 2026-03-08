//
//  AIRepository.swift
//  IsItSafe
//

import Foundation

public final class AIRepository {
    public static let shared = AIRepository()
    private let network = NetworkManager.shared

    private init() {}

    public func analyze(_ request: RiskAnalysisRequest) async throws -> RiskAnalysisResult {
        try await network.request(endpoint: .aiAnalyze, body: request, retries: 1)
    }

    public func analyzeScreenshot(_ request: ScreenshotAnalyzeRequest) async throws -> RiskAnalysisResult {
        try await network.request(endpoint: .aiAnalyzeScreenshot, body: request, retries: 1)
    }
}
