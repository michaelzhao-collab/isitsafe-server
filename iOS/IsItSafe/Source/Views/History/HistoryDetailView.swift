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
                VStack(alignment: .leading, spacing: 8) {
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
