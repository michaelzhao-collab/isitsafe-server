//
//  KnowledgeDetailViewModel.swift
//  IsItSafe
//

import Combine
import Foundation
import SwiftUI

public final class KnowledgeDetailViewModel: ObservableObject {
    @Published public var state: LoadableState<KnowledgeItem> = .idle
    @Published public var item: KnowledgeItem?

    private let knowledgeService = KnowledgeService.shared
    private let appState = AppStateViewModel.shared

    public func load(id: String) {
        if MockData.isMockModeEnabled {
            if let found = MockData.fakeKnowledgeItems.first(where: { $0.id == id }) {
                item = found
                state = .success(found)
            } else {
                state = .failure(NSError(domain: "Mock", code: 404, userInfo: [NSLocalizedDescriptionKey: "未找到该案例"]))
            }
            return
        }
        // 先展示缓存（若有）
        if let cached = KnowledgeCacheStore.shared.loadDetail(id: id) {
            item = cached
            state = .success(cached)
        } else {
            state = .loading
        }
        Task {
            do {
                let detail = try await knowledgeService.fetchDetail(id: id)
                await MainActor.run {
                    item = detail
                    state = .success(detail)
                    KnowledgeCacheStore.shared.saveDetail(id: id, item: detail)
                }
            } catch {
                await MainActor.run {
                    if item == nil { state = .failure(error) }
                    appState.showError((error as? APIError)?.userMessage ?? error.localizedDescription)
                }
            }
        }
    }
}
