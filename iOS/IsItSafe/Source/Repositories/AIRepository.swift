//
//  AIRepository.swift
//  IsItSafe
//

import Foundation

public final class AIRepository {
    public static let shared = AIRepository()
    private let network = NetworkManager.shared

    private init() {}

    // 2026-10-06：分析请求不自动重发。超时后重发会让服务端把同一条内容再算一次（大模型调两次、额度扣两次）
    public func analyze(_ request: RiskAnalysisRequest) async throws -> RiskAnalysisResult {
        try await network.request(endpoint: .aiAnalyze, body: request, retries: 0)
    }

    public func analyzeScreenshot(_ request: ScreenshotAnalyzeRequest) async throws -> RiskAnalysisResult {
        try await network.request(endpoint: .aiAnalyzeScreenshot, body: request, retries: 0)
    }
}
