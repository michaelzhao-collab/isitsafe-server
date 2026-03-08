//
//  KnowledgeView.swift
//  IsItSafe
//

import SwiftUI

private struct KnowledgeNavId: Identifiable, Hashable { let id: String }

public struct KnowledgeView: View {
    @StateObject private var vm = KnowledgeViewModel()
    @State private var selectedDetail: KnowledgeNavId?

    public init() {}

    public var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                KnowledgeCategoryTabs(selectedId: $vm.selectedCategory)
                    .padding(.vertical, 8)
                SearchBar(text: $vm.searchText, placeholder: "搜索案例") {
                    vm.applySearch()
                }
                .padding(.horizontal)
                listContent
            }
            .navigationTitle("防诈案例")
            .refreshable { vm.refresh() }
            .navigationDestination(item: $selectedDetail) { nav in
                KnowledgeDetailView(id: nav.id)
            }
        }
        .onAppear { vm.loadFirstPage() }
        .onChange(of: vm.selectedCategory) { _, _ in vm.loadFirstPage() }
    }

    private var listContent: some View {
        Group {
            if case .loading = vm.state {
                LoadingOverlay()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if case .failure(let e) = vm.state {
                ErrorStateView(message: (e as? APIError)?.userMessage ?? e.localizedDescription, retry: { vm.refresh() })
            } else if vm.items.isEmpty {
                EmptyStateView(message: "暂无案例", action: { vm.refresh() })
            } else {
                List {
                    ForEach(vm.items, id: \.id) { item in
                        Button {
                            selectedDetail = KnowledgeNavId(id: item.id)
                        } label: {
                            KnowledgeRow(item: item)
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
