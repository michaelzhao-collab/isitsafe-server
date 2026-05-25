//
//  HistoryViewModel.swift
//  IsItSafe
//

import Combine
import Foundation
import SwiftUI

public final class HistoryViewModel: ObservableObject {
    @Published public var state: LoadableState<[QueryHistoryItem]> = .idle
    @Published public var items: [QueryHistoryItem] = []
    @Published public var total = 0
    @Published public var page = 1
    @Published public var pageSize = 20
    @Published public var riskLevelFilter: String?
    @Published public var isLoadingMore = false
    @Published public var hasMore = true

    private let queryService = QueryService.shared
    private let appState = AppStateViewModel.shared

    public var canLoadHistory: Bool { appState.isLoggedIn }

    public init() {}

    public func loadFirstPage() {
        guard appState.isLoggedIn else {
            state = .empty
            items = []
            return
        }
        if MockData.isMockModeEnabled {
            items = MockData.fakeHistoryItems
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
        guard !isLoadingMore, hasMore, appState.isLoggedIn else { return }
        if MockData.isMockModeEnabled { return }
        isLoadingMore = true
        Task {
            let res = try? await queryService.fetchHistory(page: page, pageSize: pageSize, riskLevel: riskLevelFilter)
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

    /// 删除一条历史记录：有 conversationId 时按会话删，否则按单条 id 删（兼容旧数据）
    public func deleteItem(_ item: QueryHistoryItem, completion: @escaping (Bool) -> Void) {
        if MockData.isMockModeEnabled {
            items.removeAll { $0.id == item.id }
            total = max(0, total - 1)
            completion(true)
            return
        }
        Task {
            do {
                if let cid = item.conversationId, !cid.isEmpty {
                    try await queryService.deleteConversation(conversationId: cid)
                } else {
                    try await queryService.deleteHistory(id: item.id)
                }
                await MainActor.run {
                    items.removeAll { $0.id == item.id }
                    total = max(0, total - 1)
                    completion(true)
                }
            } catch {
                await MainActor.run {
                    appState.showError((error as? APIError)?.userMessage ?? error.localizedDescription)
                    completion(false)
                }
            }
        }
    }

    private func fetchPage() async {
        do {
            let res = try await queryService.fetchHistory(page: page, pageSize: pageSize, riskLevel: riskLevelFilter)
            await MainActor.run {
                items = res.items
                total = res.total
                hasMore = items.count < total
                page = 2
                state = res.items.isEmpty ? .empty : .success(res.items)
            }
        } catch {
            await MainActor.run {
                // 历史记录是后台非关键加载，静默失败，不弹全局 Toast 干扰当前页面
                state = .failure(error)
            }
        }
    }
}
