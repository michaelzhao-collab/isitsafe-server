//
//  ErrorStateView.swift
//  IsItSafe
//

import SwiftUI

public struct ErrorStateView: View {
    public var message: String
    public var retry: (() -> Void)?
    /// 重试按钮防抖：触发后 1.5s 内禁用，防连点造成重复请求
    @State private var isRetrying = false
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"

    public init(message: String, retry: (() -> Void)? = nil) {
        self.message = message
        self.retry = retry
    }

    public var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle")
                .font(.largeTitle)
                .foregroundColor(.orange)
            Text(message)
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
            if let retry = retry {
                Button(action: { triggerRetry(retry) }) {
                    HStack(spacing: 6) {
                        if isRetrying {
                            ProgressView().scaleEffect(0.8)
                        }
                        Text(isRetrying
                             ? (languageCode == "en" ? "Retrying…" : "重试中…")
                             : (languageCode == "en" ? "Retry" : "重试"))
                    }
                    .frame(minWidth: 90)
                }
                .buttonStyle(.bordered)
                .disabled(isRetrying)
                .accessibilityLabel(languageCode == "en" ? "Retry loading" : "重试加载")
                .accessibilityHint(languageCode == "en" ? "Tap to retry the failed request" : "点击重新发起请求")
            }
        }
        .frame(maxWidth: .infinity)
        .padding()
    }

    private func triggerRetry(_ retry: @escaping () -> Void) {
        guard !isRetrying else { return }
        isRetrying = true
        retry()
        // 1.5s 后恢复可点击；调用方的 loading 状态会自然替换本组件，正常情况下不会触发到 reset
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            isRetrying = false
        }
    }
}
