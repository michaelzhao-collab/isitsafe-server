//
//  SubscriptionService.swift
//  IsItSafe
//

import Foundation

public final class SubscriptionService {
    public static let shared = SubscriptionService()
    private let repo = SubscriptionRepository.shared

    private init() {}

    /// 同时返回 verify 详情（含 environment / subscription.status）和最新 status
    /// 便于区分"过期 receipt（Sandbox 限制）"vs"普通验证失败"
    public func verifyReceiptDetailed(productId: String, receipt: String, paymentMethod: String = "Apple") async throws -> (verify: SubscriptionVerifyResponse, status: SubscriptionStatusResponse) {
        let req = SubscriptionVerifyRequest(productId: productId, receipt: receipt, paymentMethod: paymentMethod)
        let v = try await repo.verify(req)
        let s = try await fetchStatus()
        return (v, s)
    }

    /// 兼容老调用方
    public func verifyReceipt(productId: String, receipt: String, paymentMethod: String = "Apple") async throws -> SubscriptionStatusResponse {
        let (_, status) = try await verifyReceiptDetailed(productId: productId, receipt: receipt, paymentMethod: paymentMethod)
        return status
    }

    public func fetchStatus() async throws -> SubscriptionStatusResponse {
        try await repo.status()
    }

    public func fetchPlans() async throws -> [MembershipPlanResponse] {
        try await repo.fetchPlans()
    }
}
