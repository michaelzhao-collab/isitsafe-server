//
//  SubscriptionRepository.swift
//  IsItSafe
//

import Foundation

public final class SubscriptionRepository {
    public static let shared = SubscriptionRepository()
    private let network = NetworkManager.shared

    private init() {}

    public func verify(_ request: SubscriptionVerifyRequest) async throws -> SubscriptionVerifyResponse {
        try await network.request(endpoint: .subscriptionVerify, body: request)
    }

    public func status() async throws -> SubscriptionStatusResponse {
        try await network.request(endpoint: .subscriptionStatus)
    }

    public func fetchPlans() async throws -> [MembershipPlanResponse] {
        try await network.request(endpoint: .membershipPlans)
    }
}

public struct SubscriptionVerifyResponse: Decodable {
    public let success: Bool
    public let subscription: SubscriptionRecord?
    /// 服务端 verify 已顺带算好的会员状态（与 GET /subscription/status 同一份）；旧服务端没有此字段
    public let status: SubscriptionStatusResponse?
}

public struct SubscriptionRecord: Codable {
    public let id: String?
    public let productId: String?
    /// 'active' | 'expired' | 'refunded' | 'revoked'
    public let status: String?
    public let expireTime: String?
    public let paymentMethod: String?
    /// 'Sandbox' | 'Production'，用于区分测试 vs 生产
    public let environment: String?
    enum CodingKeys: String, CodingKey {
        case id, status, paymentMethod, environment
        case productId = "product_id"
        case expireTime = "expire_time"
    }
}
