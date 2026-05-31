//
//  SubscriptionViewModel.swift
//  IsItSafe
//

import Combine
import Foundation
import SwiftUI

public final class SubscriptionViewModel: ObservableObject {
    @Published public var status: SubscriptionStatusResponse?
    @Published public var isLoading = false
    @Published public var purchaseState: PurchaseState = .idle
    @Published public var errorMessage: String?

    private let subscriptionService = SubscriptionService.shared
    private let appState = AppStateViewModel.shared
    private let iap = IAPManager.shared

    public init() {}

    public func loadStatus() {
        guard AuthService.shared.isLoggedIn else {
            status = nil
            return
        }
        isLoading = true
        Task {
            do {
                let s = try await subscriptionService.fetchStatus()
                await MainActor.run {
                    status = s
                    isLoading = false
                    appState.setSubscriptionActive(s.isPremium ?? s.active)
                }
            } catch {
                await MainActor.run {
                    isLoading = false
                    let msg = (error as? APIError)?.userMessage ?? error.localizedDescription
                    errorMessage = msg
                    appState.showError(msg)
                }
            }
        }
    }

    public func purchase(productId: String) {
        let productId = productId.trimmingCharacters(in: .whitespacesAndNewlines)
        purchaseState = .purchasing
        errorMessage = nil
        iap.purchase(productId: productId) { [weak self] result in
            Task { @MainActor in
                switch result {
                case .success(let receipt):
                    do {
                        let detailed = try await self?.subscriptionService.verifyReceiptDetailed(productId: productId, receipt: receipt)
                        let status = detailed?.status
                        let sub = detailed?.verify.subscription
                        let isActive = status?.isPremium == true || status?.active == true
                        if isActive {
                            self?.iap.finishTransaction(forReceipt: receipt)
                            self?.purchaseState = .purchased
                            self?.appState.setSubscriptionActive(true)
                        } else {
                            self?.purchaseState = .failed
                            // 细分失败原因：Sandbox 续费上限 vs 真过期 vs 退款 vs 撤销
                            let isSandbox = (sub?.environment ?? "").lowercased() == "sandbox"
                            let subStatus = (sub?.status ?? status?.status ?? "").lowercased()
                            let msg: String
                            if isSandbox && subStatus == "expired" {
                                msg = self?.localized(
                                    zh: "Sandbox 测试受限：当前 receipt 已过期。可能续费上限已达到。请用新 sandbox 账号或 TestFlight 真实购买重新测试。",
                                    en: "Sandbox limit reached: receipt already expired. Try a new sandbox tester account or TestFlight."
                                ) ?? ""
                            } else if subStatus == "refunded" {
                                msg = self?.localized(zh: "该笔订阅已退款", en: "This subscription has been refunded") ?? ""
                            } else if subStatus == "revoked" {
                                msg = self?.localized(zh: "该笔订阅已撤销", en: "This subscription has been revoked") ?? ""
                            } else if subStatus == "expired" {
                                msg = self?.localized(zh: "订阅已过期，请重新购买", en: "Subscription expired, please purchase again") ?? ""
                            } else {
                                msg = self?.localized(zh: "订阅验证失败，请稍后重试或联系客服", en: "Subscription verification failed. Please try again.") ?? ""
                            }
                            self?.appState.showError(msg)
                        }
                    } catch {
                        self?.purchaseState = .failed
                        let msg = (error as? APIError)?.userMessage ?? error.localizedDescription
                        self?.errorMessage = msg
                        self?.appState.showError(msg)
                    }
                case .failure(let err):
                    // 用户主动取消，静默重置，不弹错误提示
                    if case APIError.purchaseCancelledByUser = err {
                        self?.purchaseState = .idle
                        return
                    }
                    self?.purchaseState = .failed
                    let msg = (err as? APIError)?.userMessage ?? err.localizedDescription
                    self?.errorMessage = msg
                    self?.appState.showError(msg)
                }
            }
        }
    }

    public func restorePurchases() {
        purchaseState = .purchasing
        errorMessage = nil
        iap.restorePurchases { [weak self] result in
            Task { @MainActor in
                guard let self = self else { return }
                switch result {
                case .success(let payload):
                    if let (productId, receipt) = payload {
                        do {
                            _ = try await self.subscriptionService.verifyReceipt(productId: productId, receipt: receipt)
                            self.loadStatus()
                            await self.appState.refreshSubscriptionState()
                            self.appState.showSuccess(self.localized(zh: "恢复成功", en: "Restore successful"))
                        } catch {
                            let msg = (error as? APIError)?.userMessage ?? error.localizedDescription
                            self.errorMessage = msg
                            self.appState.showError(msg)
                        }
                    } else {
                        self.loadStatus()
                        self.appState.showSuccess(self.localized(zh: "未找到可恢复的订阅", en: "No restorable subscription found"))
                    }
                case .failure(let err):
                    let msg = (err as? APIError)?.userMessage ?? err.localizedDescription
                    self.errorMessage = msg
                    self.appState.showError(msg)
                }
                self.purchaseState = .idle
            }
        }
    }

    public func resetPurchaseState() {
        purchaseState = .idle
    }

    private func localized(zh: String, en: String) -> String {
        (UserDefaults.standard.string(forKey: "isitsafe.language") == "en") ? en : zh
    }
}
