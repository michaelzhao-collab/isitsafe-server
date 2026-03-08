//
//  EmptyStateView.swift
//  IsItSafe
//

import SwiftUI

public struct EmptyStateView: View {
    public var message: String
    public var action: (() -> Void)?

    public init(message: String = "暂无数据", action: (() -> Void)? = nil) {
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
                Button("重试", action: action)
                    .buttonStyle(.bordered)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
    }
}
