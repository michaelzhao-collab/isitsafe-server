//
//  KnowledgeDetailView.swift
//  IsItSafe
//

import SwiftUI

public struct KnowledgeDetailView: View {
    @StateObject private var vm: KnowledgeDetailViewModel
    private let id: String

    public init(id: String) {
        self.id = id
        _vm = StateObject(wrappedValue: KnowledgeDetailViewModel())
    }

    public var body: some View {
        Group {
            if case .loading = vm.state {
                LoadingOverlay()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if case .failure = vm.state {
                ErrorStateView(message: "加载失败", retry: { vm.load(id: id) })
            } else if let item = vm.item {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        Text(item.title)
                            .font(.title2)
                        Text(item.content)
                            .font(.body)
                        if !item.tags.isEmpty {
                            Text("标签：\(item.tags.joined(separator: "、"))")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
                }
            }
        }
        .navigationTitle("案例详情")
        .onAppear { vm.load(id: id) }
    }
}
