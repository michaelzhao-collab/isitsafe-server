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

    /// 完整刷新（初次进入 / 显式按钮）：state→loading→重置
    public func refresh() {
        loadTask?.cancel()
        loadTask = Task { [weak self] in
            await self?.performRefresh(showLoading: true)
        }
    }

    /// 下拉刷新专用：保持当前 ScrollView 不被卸下，让 .refreshable spinner 正常显示
    /// .refreshable 需要 async 闭包；vm.refresh() 是 fire-and-forget，spinner 立刻消失，所以单独走这个
    public func pullToRefresh() async {
        await performRefresh(showLoading: false)
    }

    private func performRefresh(showLoading: Bool) async {
        guard AuthInterceptor.token() != nil else {
            self.state = .notLoggedIn
            return
        }
        // 下拉刷新时不切 .loading，避免把 ScrollView 卸下来导致 spinner detach
        if showLoading {
            self.state = .loading
        }
        do {
            let feed = try await self.repo.getFeed(limit: 50, language: AppSettingsStore.shared.languageCode)
            self.state = feed.isEmpty ? .empty : .loaded(feed)
            self.unreadCount = feed.filter { !$0.isRead }.count
        } catch is CancellationError {
        } catch {
            self.state = .error(error.localizedDescription)
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
