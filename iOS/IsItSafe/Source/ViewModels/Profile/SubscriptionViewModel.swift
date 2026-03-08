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
                    appState.setSubscriptionActive(s.active)
                }
            } catch {
                await MainActor.run {
                    isLoading = false
                    errorMessage = (error as? APIError)?.userMessage ?? error.localizedDescription
                }
            }
        }
    }

    public func purchase(productId: String) {
        purchaseState = .purchasing
        errorMessage = nil
        iap.purchase(productId: productId) { [weak self] result in
            Task { @MainActor in
                switch result {
                case .success(let receipt):
                    do {
                        _ = try await self?.subscriptionService.verifyReceipt(productId: productId, receipt: receipt)
                        self?.purchaseState = .purchased
                        self?.loadStatus()
                        await self?.appState.refreshSubscriptionState()
                    } catch {
                        self?.purchaseState = .failed
                        self?.errorMessage = (error as? APIError)?.userMessage ?? error.localizedDescription
                    }
                case .failure(let err):
                    self?.purchaseState = .failed
                    self?.errorMessage = err.localizedDescription
                }
            }
        }
    }

    public func restorePurchases() {
        purchaseState = .purchasing
        iap.restorePurchases { [weak self] in
            Task { @MainActor in
                self?.loadStatus()
                self?.purchaseState = .idle
            }
        }
    }
}
