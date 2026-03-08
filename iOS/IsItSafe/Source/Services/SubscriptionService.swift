//
//  SubscriptionService.swift
//  IsItSafe
//

import Foundation

public final class SubscriptionService {
    public static let shared = SubscriptionService()
    private let repo = SubscriptionRepository.shared

    private init() {}

    public func verifyReceipt(productId: String, receipt: String, paymentMethod: String = "Apple") async throws -> SubscriptionStatusResponse {
        let req = SubscriptionVerifyRequest(productId: productId, receipt: receipt, paymentMethod: paymentMethod)
        _ = try await repo.verify(req)
        return try await fetchStatus()
    }

    public func fetchStatus() async throws -> SubscriptionStatusResponse {
        try await repo.status()
    }
}
