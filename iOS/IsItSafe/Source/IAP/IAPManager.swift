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

    /// V5：常驻 Transaction.updates 监听任务（避免被 deinit 取消，单例生命周期与 App 一致）
    private var updatesListenerTask: Task<Void, Never>?
    /// 本会话内已处理过的交易 id：启动时 `Transaction.unfinished` 与 `Transaction.updates`
    /// 的首次重投可能投递同一笔，去重避免重复 verify / finish（在 MainActor 上读写）
    private var handledTransactionIds: Set<UInt64> = []

    private init() {}

    /// V5：App 启动时调用一次。
    ///  ① 处理 `Transaction.unfinished` 里残留的交易；
    ///  ② 持续监听 `Transaction.updates`（自动续期、他设备购买、Ask to Buy 审批通过、上次 verify 失败的重投都走这里）。
    /// 处理规则见 handleTransactionUpdate。
    public func startTransactionMonitor() {
        guard updatesListenerTask == nil else { return }
        Task { [weak self] in
            for await result in Transaction.unfinished {
                await self?.handleTransactionUpdate(result)
            }
        }
        updatesListenerTask = Task.detached { [weak self] in
            for await update in Transaction.updates {
                await self?.handleTransactionUpdate(update)
            }
        }
    }

    /// 监听/重投交易的统一处理：
    ///  - 仍有效（续期 / 他设备购买 / 上次 verify 失败重投）：后端 verify 成功才 finish，
    ///    失败或无登录态则保留 unfinished，下次启动重投再试——保证"扣了钱一定有补账机会"。
    ///  - 已过期 / 已撤销：无可恢复价值（过期补验证不产生服务时长；退款降级由 App Store
    ///    Server Notification 兜底），有登录态时尽力给后端留痕，随后无论成败都 finish，防止堆积。
    private func handleTransactionUpdate(_ result: VerificationResult<Transaction>) async {
        guard let transaction = try? checkVerified(result) else { return }
        let txId = transaction.id
        let alreadyHandled = await MainActor.run { () -> Bool in
            // 购买路径（purchase → verify → finishTransaction）正在处理的交易不抢
            if self.pendingTransactions.values.contains(where: { $0.id == txId }) { return true }
            return !self.handledTransactionIds.insert(txId).inserted
        }
        if alreadyHandled { return }

        let receipt = result.jwsRepresentation
        let isRevoked = transaction.revocationDate != nil
        let isExpired = (transaction.expirationDate ?? .distantFuture) < Date()
        let hasSession = AuthInterceptor.token() != nil

        if isRevoked || isExpired {
            if hasSession {
                _ = try? await SubscriptionService.shared.verifyReceipt(
                    productId: transaction.productID, receipt: receipt
                )
            }
            #if DEBUG
            print("[IAP] finish stale transaction id=\(txId) productId=\(transaction.productID) expired=\(isExpired) revoked=\(isRevoked)")
            #endif
            await transaction.finish()
            return
        }

        guard hasSession else { return }
        do {
            _ = try await SubscriptionService.shared.verifyReceipt(
                productId: transaction.productID, receipt: receipt
            )
            await transaction.finish()
            #if DEBUG
            print("[IAP] monitor verified & finished id=\(txId) productId=\(transaction.productID)")
            #endif
            await AppStateViewModel.shared.refreshSubscriptionState()
        } catch {
            #if DEBUG
            print("[IAP] monitor verify failed, keep unfinished id=\(txId): \(error)")
            #endif
            _ = await MainActor.run { self.handledTransactionIds.remove(txId) }
        }
    }

    /// 2026-09-27 复核：返回 App Store 本地化价格串（如 ¥68 / JP¥1,600），
    /// 拿不到（产品未加载）返回 nil，调用方回退服务端配置价。
    public func displayPrice(for productId: String) -> String? {
        products[productId]?.displayPrice
    }

    /// 该产品当前是否符合首购优惠资格（StoreKit 判定，比服务端标记准）
    public func isEligibleForIntroOffer(_ productId: String) -> Bool {
        products[productId]?.subscription?.introductoryOffer != nil
    }

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
            // V5 修复：不在购买前调 AppStore.sync()。
            // sync() 会弹 Apple ID 密码框，且把未 finish 的旧交易塞回 purchase() 结果，
            // 导致 Sandbox 测试号"卡死"在过期 receipt 上。Apple 文档明确 sync() 仅用于 Restore。
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
