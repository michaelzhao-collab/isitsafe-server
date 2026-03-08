//
//  MessageCenterView.swift
//  IsItSafe
//
//  消息中心：列表展示，点进某条标记已读（红点消失）。
//

import SwiftUI

public struct MessageCenterView: View {
    @State private var items: [AppMessageItem] = []
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
                    Text("暂无消息")
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
            .navigationTitle("消息中心")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("完成") { dismiss() }
                }
            }
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
                    Text(Formatter.isoDate(item.createdAt)?.formatted(date: .abbreviated, time: .shortened) ?? item.createdAt)
                        .font(.caption)
                        .foregroundColor(AppTheme.secondaryText)
                }
                Text(item.content)
                    .font(.subheadline)
                    .foregroundColor(AppTheme.secondaryText)
                    .lineLimit(2)
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
