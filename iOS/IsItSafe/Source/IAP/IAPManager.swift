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
    private var lastFetchError: String?
    /// 等待后端 verify 完成才能 finish 的 StoreKit 交易；key 为 receipt JWS（用于精确匹配）
    private var pendingTransactions: [String: Transaction] = [:]

    private init() {}

    public func fetchProducts() async -> [Product] {
        await fetchProducts(ids: ProductIdentifiers.all)
    }

    /// 按指定商品 ID 拉取（用于后台下发的套餐 productId）
    public func fetchProducts(ids: Set<String>) async -> [Product] {
        guard !ids.isEmpty else { return [] }
        do {
            print("IAP fetchProducts request ids:", Array(ids).sorted())
            let list = try await Product.products(for: ids)
            await MainActor.run {
                for p in list { products[p.id] = p }
            }
            if list.isEmpty {
                // 拉取成功但返回空：说明 productId 在 App Store Connect / StoreKit 配置文件中不存在
                let hint = "StoreKit returned 0 products for ids: \(Array(ids).sorted()). " +
                    "Check: 1) Xcode Scheme → Run → Options → StoreKit Configuration is set; " +
                    "2) App Store Connect product IDs match exactly; " +
                    "3) Products are not in 'Missing Metadata' state."
                print("IAP WARNING:", hint)
                lastFetchError = hint
            } else {
                print("IAP fetchProducts returned ids:", list.map { $0.id }.sorted())
                lastFetchError = nil
            }
            return list
        } catch {
            print("IAP fetchProducts error:", error.localizedDescription, error)
            lastFetchError = error.localizedDescription
            return []
        }
    }

    public func purchase(productId: String, completion: @escaping (Result<String, Error>) -> Void) {
        Task {
            #if targetEnvironment(simulator)
            await MainActor.run {
                completion(.failure(APIError.unknown(localized(
                    zh: "模拟器无法完成 App 内购买，请在真机登录沙盒账号后测试订阅。",
                    en: "In-App Purchase isn’t available in the Simulator. Test subscription on a device with a sandbox Apple ID."
                ))))
            }
            return
            #endif
            #if DEBUG
            print("IAP purchase start productId:", productId)
            #endif
            // 先同步 App Store，清理旧的未完成交易，避免重复购买报"无法完成请求"
            try? await AppStore.sync()
            if products[productId] == nil {
                _ = await fetchProducts(ids: [productId])
            }
            guard let product = products[productId] else {
                // 仅打印到控制台，不暴露给用户
                if let detail = lastFetchError, !detail.isEmpty {
                    print("IAP product not found detail:", detail)
                }
                let msg = localized(
                    zh: "商品不可用，请稍后重试",
                    en: "Product unavailable. Please try again later."
                )
                await MainActor.run { completion(.failure(APIError.unknown(msg))) }
                return
            }
            do {
                let result = try await product.purchase()
                switch result {
                case .success(let verification):
                    #if DEBUG
                    print("IAP purchase result: success")
                    #endif
                    let receipt = verification.jwsRepresentation
                    let transaction = try checkVerified(verification)
                    // 暂存交易，等后端 verify 成功后由调用方触发 finish，避免 verify 失败时丢失补救机会
                    await MainActor.run {
                        self.pendingTransactions[receipt] = transaction
                        completion(.success(receipt))
                    }
                case .userCancelled:
                    #if DEBUG
                    print("IAP purchase result: userCancelled")
                    #endif
                    await MainActor.run {
                        completion(.failure(APIError.purchaseCancelledByUser))
                    }
                case .pending:
                    #if DEBUG
                    print("IAP purchase result: pending")
                    #endif
                    await MainActor.run {
                        completion(.failure(APIError.unknown(localized(zh: "等待审批", en: "Purchase pending approval"))))
                    }
                @unknown default:
                    #if DEBUG
                    print("IAP purchase result: unknown")
                    #endif
                    await MainActor.run {
                        completion(.failure(APIError.unknown(localized(zh: "未知状态", en: "Unknown purchase state"))))
                    }
                }
            } catch {
                #if DEBUG
                print("IAP purchase throw error:", error.localizedDescription)
                #endif
                await MainActor.run { completion(.failure(error)) }
            }
        }
    }

    /// 后端 verify 成功后调用，标记该交易已处理完，App Store 才不会在下次启动重投。
    /// verify 失败则不要调用此方法 —— 下次启动 `Transaction.updates` / `currentEntitlements` 会再次推送，给后端兜底重试的机会。
    public func finishTransaction(forReceipt receipt: String) {
        Task {
            guard let transaction = await MainActor.run(body: { self.pendingTransactions.removeValue(forKey: receipt) }) else {
                return
            }
            await transaction.finish()
        }
    }

    /// 恢复购买：先与 App Store 同步，再取当前权益中最新一条订阅的 JWS 发后端核验；completion 传入 (productId, receipt)? 供调用方调 verify，无权益时传 nil。
    public func restorePurchases(completion: @escaping (Result<(productId: String, receipt: String)?, Error>) -> Void) {
        Task {
            do {
                try await AppStore.sync()
                var latest: (productId: String, receipt: String)?
                var latestDate: Date?
                for await result in Transaction.currentEntitlements {
                    guard case .verified(let transaction) = result else { continue }
                    let exp = transaction.expirationDate ?? .distantFuture
                    if exp > Date(), (latestDate == nil || exp > latestDate!) {
                        latestDate = exp
                        latest = (transaction.productID, result.jwsRepresentation)
                    }
                }
                await MainActor.run { completion(.success(latest)) }
            } catch {
                await MainActor.run { completion(.failure(error)) }
            }
        }
    }

    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .unverified: throw APIError.subscriptionVerifyFailed
        case .verified(let t): return t
        }
    }

    private func localized(zh: String, en: String) -> String {
        (UserDefaults.standard.string(forKey: "isitsafe.language") == "en") ? en : zh
    }

}
