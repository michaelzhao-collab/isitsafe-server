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
    @Published public var isRefreshing = false
    @Published public var categories: [KnowledgeCategoryItem] = []

    private let knowledgeService = KnowledgeService.shared
    private let appState = AppStateViewModel.shared
    private let cache = KnowledgeCacheStore.shared

    public init() {}

    /// 进入页面时调用：先展示本地缓存（若有），再请求服务端并更新
    public func loadFirstPage() {
        if MockData.isMockModeEnabled {
            items = MockData.fakeKnowledgeItems
            total = items.count
            hasMore = false
            page = 2
            state = items.isEmpty ? .empty : .success(items)
            return
        }
        let cat = selectedCategory
        let search = searchText.isEmpty ? nil : searchText
        if let cached = cache.load(category: cat, search: search), !cached.items.isEmpty {
            items = cached.items
            total = cached.total
            hasMore = items.count < total
            page = 2
            state = .success(items)
        } else {
            state = .loading
            page = 1
            hasMore = true
        }
        Task {
            await fetchPage(saveToCache: true)
            await fetchCategoriesIfNeeded()
        }
    }

    public func loadMore() {
        guard !isLoadingMore, hasMore else { return }
        if MockData.isMockModeEnabled { return }
        isLoadingMore = true
        let currentPage = page
        let cat = selectedCategory
        let search = searchText.isEmpty ? nil : searchText
        Task {
            let res = try? await knowledgeService.fetchList(
                category: cat,
                page: currentPage,
                pageSize: pageSize,
                search: search,
                language: AppSettingsStore.shared.languageCode == "en" ? "en" : "zh"
            )
            await MainActor.run {
                isLoadingMore = false
                if let r = res {
                    items.append(contentsOf: r.items)
                    total = r.total
                    page = currentPage + 1
                    hasMore = items.count < total
                    state = items.isEmpty ? .empty : .success(items)
                }
            }
        }
    }

    /// 下拉刷新：拉取最新第一页，更新列表并同步缓存
    public func refresh() {
        if MockData.isMockModeEnabled { loadFirstPage(); return }
        isRefreshing = true
        page = 1
        hasMore = true
        Task {
            await fetchPage(saveToCache: true)
            await MainActor.run { isRefreshing = false }
        }
    }

    public func applySearch() {
        loadFirstPage()
    }

    private func fetchPage(saveToCache: Bool) async {
        let cat = selectedCategory
        let search = searchText.isEmpty ? nil : searchText
        let lang = AppSettingsStore.shared.languageCode == "en" ? "en" : "zh"
        do {
            let res = try await knowledgeService.fetchList(
                category: cat,
                page: 1,
                pageSize: pageSize,
                search: search,
                language: lang
            )
            await MainActor.run {
                let newItems = res.items
                let newTotal = res.total
                if saveToCache {
                    cache.save(category: cat, search: search, items: newItems, total: newTotal)
                }
                items = newItems
                total = newTotal
                hasMore = newItems.count < newTotal
                page = 2
                state = newItems.isEmpty ? .empty : .success(newItems)
            }
        } catch {
            await MainActor.run {
                if items.isEmpty { state = .failure(error) }
                appState.showError((error as? APIError)?.userMessage ?? error.localizedDescription)
            }
        }
    }

    private func fetchCategoriesIfNeeded() async {
        if !categories.isEmpty { return }
        let lang = AppSettingsStore.shared.languageCode == "en" ? "en" : "zh"
        do {
            let list = try await knowledgeService.fetchCategories(language: lang)
            await MainActor.run {
                self.categories = list
            }
        } catch {
            // 静默失败，不影响主列表
        }
    }
}
