//
//  LoadingOverlay.swift
//  IsItSafe
//

import SwiftUI

public struct LoadingOverlay: View {
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    public var message: String

    public init(message: String = L10n.tr(zh: "加载中...", en: "Loading...")) {
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
