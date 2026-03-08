//
//  LoadingOverlay.swift
//  IsItSafe
//

import SwiftUI

public struct LoadingOverlay: View {
    public var message: String = "加载中..."

    public init(message: String = "加载中...") {
        self.message = message
    }

    public var body: some View {
        ZStack {
            Color.black.opacity(0.3)
                .ignoresSafeArea()
            VStack(spacing: 12) {
                ProgressView()
                    .scaleEffect(1.2)
                    .tint(.white)
                Text(message)
                    .font(.subheadline)
                    .foregroundColor(.white)
            }
            .padding(24)
            .background(.ultraThinMaterial)
            .cornerRadius(12)
        }
    }
}
