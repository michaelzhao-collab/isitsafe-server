//
//  KnowledgeViewModel.swift
//  IsItSafe
//

import Combine
import Foundation
import SwiftUI

public final class KnowledgeViewModel: ObservableObject {
    @Published public var state: LoadableState<[KnowledgeItem]> = .idle
    @Published public var items: [KnowledgeItem] = []
    @Published public var total = 0
    @Published public var page = 1
    @Published public var pageSize = 20
    @Published public var selectedCategory: String?
    @Published public var searchText = ""
    @Published public var isLoadingMore = false
    @Published public var hasMore = true

    private let knowledgeService = KnowledgeService.shared
    private let appState = AppStateViewModel.shared

    public init() {}

    public func loadFirstPage() {
        if MockData.isMockModeEnabled {
            items = MockData.fakeKnowledgeItems
            total = items.count
            hasMore = false
            page = 2
            state = items.isEmpty ? .empty : .success(items)
            return
        }
        state = .loading
        page = 1
        hasMore = true
        Task {
            await fetchPage()
        }
    }

    public func loadMore() {
        guard !isLoadingMore, hasMore else { return }
        if MockData.isMockModeEnabled { return }
        isLoadingMore = true
        Task {
            let res = try? await knowledgeService.fetchList(category: selectedCategory, page: page, pageSize: pageSize, search: searchText.isEmpty ? nil : searchText, language: "zh")
            await MainActor.run {
                isLoadingMore = false
                if let r = res {
                    items.append(contentsOf: r.items)
                    total = r.total
                    page += 1
                    hasMore = items.count < total
                    state = items.isEmpty ? .empty : .success(items)
                }
            }
        }
    }

    public func refresh() {
        loadFirstPage()
    }

    public func applySearch() {
        loadFirstPage()
    }

    private func fetchPage() async {
        do {
            let res = try await knowledgeService.fetchList(category: selectedCategory, page: 1, pageSize: pageSize, search: searchText.isEmpty ? nil : searchText, language: "zh")
            await MainActor.run {
                items = res.items
                total = res.total
                hasMore = items.count < total
                page = 2
                state = res.items.isEmpty ? .empty : .success(res.items)
            }
        } catch {
            await MainActor.run {
                state = .failure(error)
                appState.showError((error as? APIError)?.userMessage ?? error.localizedDescription)
            }
        }
    }
}
