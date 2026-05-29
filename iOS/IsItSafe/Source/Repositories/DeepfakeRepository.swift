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

    /// S2-4 把检测结果一键广播到家庭（依赖 E 模块）
    public func broadcastToFamily(taskId: String) async throws -> DeepfakeBroadcastResult {
        struct Empty: Codable {}
        return try await network.request(
            endpoint: .v3DeepfakeBroadcast(taskId: taskId),
            body: Empty()
        )
    }

    /// S2-5 SSE 流式结果。优先 SSE，失败时调用方应 fallback 到 getResult(taskId)
    /// 用法：
    ///   try await repo.streamResult(taskId: id) { state in handleUpdate(state) }
    /// stream 在 server complete / 网络断开时返回
    public func streamResult(
        taskId: String,
        onEvent: @escaping (DeepfakeCheck) -> Void
    ) async throws {
        try await DeepfakeStreamClient.shared.stream(taskId: taskId, onEvent: onEvent)
    }
}

/// 服务端返回的广播结果（与 FamilyService.createBroadcast 同结构）
public struct DeepfakeBroadcastResult: Decodable {
    public let delivered: Bool
    public let broadcastId: String?
    public let resultLabel: String
    public let quotaRemaining: Int
    public let skipReason: String?

    enum CodingKeys: String, CodingKey {
        case delivered
        case broadcastId
        case resultLabel
        case quotaRemaining
        case skipReason
    }

    public var userMessage: String {
        if delivered { return "已广播给家人 ✓" }
        switch skipReason {
        case "duplicate": return "今天已广播过该内容"
        case "quota_exceeded": return "今日家庭官方提醒已用完"
        case "no_group": return "未加入家庭组，无法广播"
        case "disabled_by_user": return "你已关闭'自动广播'选项"
        case "in_progress": return "正在处理中，稍后查看"
        default: return "广播未送达"
        }
    }
}
