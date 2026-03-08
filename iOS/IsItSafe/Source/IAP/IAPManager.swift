//
//  IAPManager.swift
//  IsItSafe
//
//  获取商品、发起购买、恢复购买；与 StoreKit 对接，当前为简版占位，完整流程已接好 verify。
//

import Combine
import Foundation
import StoreKit

public final class IAPManager: ObservableObject {
    public static let shared = IAPManager()
    private var products: [String: Product] = [:]

    private init() {}

    public func fetchProducts() async -> [Product] {
        do {
            let list = try await Product.products(for: ProductIdentifiers.all)
            await MainActor.run {
                for p in list { products[p.id] = p }
            }
            return list
        } catch {
            return []
        }
    }

    public func purchase(productId: String, completion: @escaping (Result<String, Error>) -> Void) {
        Task {
            if products[productId] == nil {
                _ = await fetchProducts()
            }
            guard let product = products[productId] else {
                await MainActor.run { completion(.failure(APIError.unknown("商品不存在"))) }
                return
            }
            do {
                let result = try await product.purchase()
                switch result {
                case .success(let verification):
                    let receipt = verification.jwsRepresentation
                    let transaction = try checkVerified(verification)
                    await MainActor.run { completion(.success(receipt)) }
                    await transaction.finish()
                case .userCancelled:
                    await MainActor.run { completion(.failure(APIError.unknown("用户取消"))) }
                case .pending:
                    await MainActor.run { completion(.failure(APIError.unknown("等待审批"))) }
                @unknown default:
                    await MainActor.run { completion(.failure(APIError.unknown("未知状态"))) }
                }
            } catch {
                await MainActor.run { completion(.failure(error)) }
            }
        }
    }

    public func restorePurchases(completion: @escaping () -> Void) {
        Task {
            do {
                try await AppStore.sync()
                await MainActor.run { completion() }
            } catch {
                await MainActor.run { completion() }
            }
        }
    }

    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .unverified: throw APIError.subscriptionVerifyFailed
        case .verified(let t): return t
        }
    }

}
