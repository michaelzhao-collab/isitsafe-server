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
}

public struct SubscriptionVerifyResponse: Codable {
    public let success: Bool
    public let subscription: SubscriptionRecord?
}

public struct SubscriptionRecord: Codable {
    public let id: String?
    public let productId: String?
    public let status: String?
    public let expireTime: String?
    public let paymentMethod: String?
    enum CodingKeys: String, CodingKey {
        case id, status, paymentMethod
        case productId = "product_id"
        case expireTime = "expire_time"
    }
}
