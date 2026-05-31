//
//  IntelViewModel.swift
//  IsItSafe
//
//  V3-B 情报 Tab + 首页通知条共用 ViewModel
//

import Foundation
import Combine

@MainActor
public final class IntelViewModel: ObservableObject {
    public enum State: Equatable {
        case loading
        case loaded([IntelAlertSummary])
        case empty
        case error(String)
        case notLoggedIn

        public static func == (lhs: State, rhs: State) -> Bool {
            switch (lhs, rhs) {
            case (.loading, .loading), (.empty, .empty), (.notLoggedIn, .notLoggedIn): return true
            case (.loaded(let a), .loaded(let b)): return a.count == b.count && a.map(\.id) == b.map(\.id)
            case (.error(let a), .error(let b)): return a == b
            default: return false
            }
        }
    }

    @Published public var state: State = .loading
    @Published public var unreadCount: Int = 0

    private let repo = IntelRepository.shared
    private var loadTask: Task<Void, Never>?

    public init() {}

    public func refresh() {
        loadTask?.cancel()
        loadTask = Task { [weak self] in
            guard let self else { return }
            guard AuthInterceptor.token() != nil else {
                self.state = .notLoggedIn
                return
            }
            self.state = .loading
            do {
                // 按 UI 语言拉对应语言情报（之前传 nil 会回落到 user.language，与 UI 不同步）
                let feed = try await self.repo.getFeed(limit: 50, language: AppSettingsStore.shared.languageCode)
                self.state = feed.isEmpty ? .empty : .loaded(feed)
                self.unreadCount = feed.filter { !$0.isRead }.count
            } catch is CancellationError {
            } catch {
                self.state = .error(error.localizedDescription)
            }
        }
    }

    /// 仅刷新未读数（首页通知条用，开销小）
    public func refreshUnreadCount() async {
        guard AuthInterceptor.token() != nil else { return }
        do {
            unreadCount = try await repo.getUnreadCount()
        } catch {
            // 静默
        }
    }
}
