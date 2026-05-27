//
//  DeepfakeRepository.swift
//  IsItSafe
//

import Foundation

public final class DeepfakeRepository {
    public static let shared = DeepfakeRepository()
    private let network = NetworkManager.shared
    private init() {}

    public func create(sourceType: String, fileUrl: String, fileDurationSec: Int?) async throws -> DeepfakeCheck {
        try await network.request(
            endpoint: .v3DeepfakeCreate,
            body: DeepfakeCreateRequest(sourceType: sourceType, fileUrl: fileUrl, fileDurationSec: fileDurationSec)
        )
    }

    public func getResult(taskId: String) async throws -> DeepfakeCheck {
        try await network.request(endpoint: .v3DeepfakeResult(taskId: taskId))
    }

    public func getHistory(limit: Int = 50) async throws -> [DeepfakeCheck] {
        try await network.request(endpoint: .v3DeepfakeHistory(limit: limit))
    }

    public func delete(taskId: String) async throws {
        try await network.requestVoid(endpoint: .v3DeepfakeDelete(taskId: taskId))
    }

    public func submitFeedback(taskId: String, accurate: Bool) async throws {
        try await network.requestVoid(
            endpoint: .v3DeepfakeFeedback(taskId: taskId),
            body: DeepfakeFeedbackRequest(feedback: accurate ? "accurate" : "inaccurate")
        )
    }
}
