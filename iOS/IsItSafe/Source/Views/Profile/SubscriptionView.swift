//
//  SubscriptionView.swift
//  IsItSafe
//

import SwiftUI

public struct SubscriptionView: View {
    @StateObject private var vm = SubscriptionViewModel()
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppStateViewModel

    public init() {}

    public var body: some View {
        NavigationStack {
            List {
                if vm.isLoading {
                    HStack { Spacer(); ProgressView(); Spacer() }
                } else if let status = vm.status {
                    Section(L10n.tr(zh: "当前状态", en: "Current Status")) {
                        Label(status.active ? L10n.tr(zh: "已订阅", en: "Subscribed") : L10n.tr(zh: "未订阅", en: "Not subscribed"), systemImage: status.active ? "checkmark.circle" : "xmark.circle")
                        if let exp = status.expireTime {
                            Text(L10n.tr(zh: "到期：", en: "Expires: ") + exp)
                                .font(.caption)
                        }
                    }
                }
                Section(L10n.tr(zh: "订阅选项", en: "Plans")) {
                    ForEach(SubscriptionPlan.all) { plan in
                        HStack {
                            VStack(alignment: .leading) {
                                Text(plan.name)
                                Text(plan.period)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            Spacer()
                            Text(plan.price)
                            Button(L10n.tr(zh: "购买", en: "Buy")) {
                                vm.purchase(productId: plan.productId)
                            }
                            .disabled(vm.purchaseState == .purchasing)
                        }
                    }
                }
                Section {
                    Button(L10n.tr(zh: "恢复购买", en: "Restore Purchases")) {
                        vm.restorePurchases()
                    }
                }
                if let msg = vm.errorMessage {
                    Section {
                        Text(msg)
                            .foregroundColor(.red)
                            .font(.caption)
                    }
                }
            }
            .navigationTitle(L10n.tr(zh: "订阅", en: "Subscription"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button(L10n.tr(zh: "完成", en: "Done")) { dismiss() }
                }
            }
            .onAppear {
                vm.loadStatus()
            }
        }
    }
}
