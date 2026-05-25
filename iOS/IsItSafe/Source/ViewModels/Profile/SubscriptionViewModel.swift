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
                        let status = try await self?.subscriptionService.verifyReceipt(productId: productId, receipt: receipt)
                        // 以服务器返回的订阅状态为准，防止误判
                        let isActive = status?.isPremium == true || status?.active == true
                        if isActive {
                            // 后端落库成功后才向 App Store 确认 finish，避免 verify 失败时丢失补救机会。
                            // 失败路径不 finish，下次启动 currentEntitlements 会重新推送。
                            self?.iap.finishTransaction(forReceipt: receipt)
                            self?.purchaseState = .purchased
                            self?.appState.setSubscriptionActive(true)
                        } else {
                            self?.purchaseState = .failed
                            self?.appState.showError(self?.localized(zh: "订阅验证失败，请稍后重试或联系客服", en: "Subscription verification failed. Please try again.") ?? "")
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
