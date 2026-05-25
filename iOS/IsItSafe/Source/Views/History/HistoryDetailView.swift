//
//  HistoryDetailView.swift
//  IsItSafe
//

import SwiftUI

public struct HistoryDetailView: View {
    @StateObject private var vm: HistoryDetailViewModel

    public init(item: QueryHistoryItem) {
        _vm = StateObject(wrappedValue: HistoryDetailViewModel(item: item))
    }

    public var body: some View {
        ScrollView {
            if let data = vm.viewData {
                RiskResultCard(data: data)
                    .padding()
            }
            if let item = vm.item {
                VStack(alignment: .leading, spacing: 12) {
                    if let urlString = item.imageUrl, !urlString.isEmpty, let url = URL(string: urlString) {
                        AsyncImage(url: url) { phase in
                            switch phase {
                            case .success(let image):
                                image
                                    .resizable()
                                    .scaledToFit()
                            case .failure:
                                Image(systemName: "photo")
                                    .font(.title)
                                    .foregroundColor(.secondary)
                                    .frame(height: 160)
                            case .empty:
                                ProgressView()
                                    .frame(height: 160)
                            @unknown default:
                                EmptyView()
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                    Text("原文")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text(item.content)
                        .font(.body)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding()
            }
        }
        .navigationTitle("分析详情")
    }
}
