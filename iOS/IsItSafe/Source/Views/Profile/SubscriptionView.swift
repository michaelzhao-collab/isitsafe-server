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
                    Section("当前状态") {
                        Label(status.active ? "已订阅" : "未订阅", systemImage: status.active ? "checkmark.circle" : "xmark.circle")
                        if let exp = status.expireTime {
                            Text("到期：\(exp)")
                                .font(.caption)
                        }
                    }
                }
                Section("订阅选项") {
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
                            Button("购买") {
                                vm.purchase(productId: plan.productId)
                            }
                            .disabled(vm.purchaseState == .purchasing)
                        }
                    }
                }
                Section {
                    Button("恢复购买") {
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
            .navigationTitle("订阅")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("完成") { dismiss() }
                }
            }
            .onAppear {
                vm.loadStatus()
            }
        }
    }
}
