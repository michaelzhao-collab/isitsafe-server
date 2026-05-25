//
//  MessageCenterView.swift
//  IsItSafe
//
//  消息中心：列表展示，点进某条标记已读（红点消失）。
//

import SwiftUI

public struct MessageCenterView: View {
    @State private var items: [AppMessageItem] = []
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    @State private var loading = true
    @State private var errorMessage: String?
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppStateViewModel

    public init() {}

    public var body: some View {
        NavigationStack {
            Group {
                if loading && items.isEmpty {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let err = errorMessage {
                    Text(err)
                        .foregroundColor(AppTheme.secondaryText)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if items.isEmpty {
                    Text(languageCode == "en" ? "No messages" : "暂无消息")
                        .foregroundColor(AppTheme.secondaryText)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List {
                        ForEach(items) { item in
                            MessageRow(item: item) {
                                markReadAndOpen(item: item)
                            }
                        }
                    }
                    .listStyle(.insetGrouped)
                }
            }
            .background(AppTheme.background)
            .navigationTitle(languageCode == "en" ? "Messages" : "消息中心")
            .navigationBarTitleDisplayMode(.inline)
            .onAppear { load() }
        }
    }

    private func load() {
        guard appState.isLoggedIn else { return }
        loading = true
        errorMessage = nil
        Task {
            do {
                let res = try await MessageService.shared.list()
                await MainActor.run {
                    items = res.items
                    loading = false
                    // 进入消息中心并成功加载列表后，认为所有消息已查看，清空未读红点
                    appState.setHasUnreadMessages(false)
                }
            } catch {
                await MainActor.run {
                    errorMessage = (error as? APIError)?.userMessage ?? error.localizedDescription
                    loading = false
                }
            }
        }
    }

    private func markReadAndOpen(item: AppMessageItem) {
        if !item.read {
            Task {
                try? await MessageService.shared.markRead(id: item.id)
                await MainActor.run {
                    if let idx = items.firstIndex(where: { $0.id == item.id }) {
                        items[idx] = AppMessageItem(id: item.id, title: item.title, content: item.content, link: item.link, createdAt: item.createdAt, read: true)
                    }
                }
            }
        }
        if let link = item.link, let url = URL(string: link), !link.isEmpty {
            UIApplication.shared.open(url)
        }
    }
}

private struct MessageRow: View {
    let item: AppMessageItem
    let onTap: () -> Void

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy/MM/dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        return f
    }()

    private var dateText: String {
        guard let date = Formatter.isoDate(item.createdAt) else { return item.createdAt }
        return Self.dateFormatter.string(from: date)
    }

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .top) {
                    Text(item.title)
                        .font(.headline)
                        .foregroundColor(.primary)
                    if !item.read {
                        Circle()
                            .fill(Color.red)
                            .frame(width: 8, height: 8)
                    }
                    Spacer(minLength: 0)
                    Text(dateText)
                        .font(.caption)
                        .foregroundColor(AppTheme.secondaryText)
                }
                Text(item.content)
                    .font(.subheadline)
                    .foregroundColor(AppTheme.secondaryText)
                if let link = item.link, !link.isEmpty {
                    Text(link)
                        .font(.caption)
                        .foregroundColor(AppTheme.primary)
                        .lineLimit(1)
                }
            }
            .padding(.vertical, 4)
        }
        .buttonStyle(.plain)
    }
}
