//
//  EmptyStateView.swift
//  IsItSafe
//

import SwiftUI

public struct EmptyStateView: View {
    public var message: String
    public var action: (() -> Void)?

    public init(message: String = L10n.tr(zh: "暂无数据", en: "No data"), action: (() -> Void)? = nil) {
        self.message = message
        self.action = action
    }

    public var body: some View {
        VStack(spacing: 16) {
            Text(message)
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
            if let action = action {
                Button(L10n.tr(zh: "重试", en: "Retry"), action: action)
                    .buttonStyle(.bordered)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
    }
}
