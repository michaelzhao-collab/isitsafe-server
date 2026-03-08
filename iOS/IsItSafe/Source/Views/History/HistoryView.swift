//
//  HistoryView.swift
//  IsItSafe
//

import SwiftUI

public struct HistoryView: View {
    @StateObject private var vm = HistoryViewModel()
    @State private var selectedItem: QueryHistoryItem?
    @EnvironmentObject private var appState: AppStateViewModel
    @EnvironmentObject private var router: AppRouter

    public init() {}

    public var body: some View {
        NavigationStack {
            Group {
                if !appState.isLoggedIn {
                    EmptyStateView(message: "登录后查看历史记录") {
                        router.showLogin()
                    }
                } else {
                    listContent
                }
            }
            .navigationTitle("历史")
            .refreshable { vm.refresh() }
            .navigationDestination(item: $selectedItem) { item in
                HistoryDetailView(item: item)
            }
        }
        .onAppear { vm.refresh() }
    }

    private var listContent: some View {
        Group {
            if vm.items.isEmpty && !vm.state.isLoading {
                EmptyStateView(message: "暂无历史记录", action: { vm.refresh() })
            } else {
                List {
                    ForEach(vm.items, id: \.id) { item in
                        Button {
                            selectedItem = item
                        } label: {
                            HistoryRow(item: item)
                        }
                        .onAppear {
                            if item.id == vm.items.last?.id { vm.loadMore() }
                        }
                    }
                }
                .listStyle(.plain)
            }
        }
    }
}
