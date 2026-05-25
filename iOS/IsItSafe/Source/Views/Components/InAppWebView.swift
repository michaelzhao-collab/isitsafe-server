//
//  InAppWebView.swift
//  IsItSafe
//
//  在 APP 内打开 URL（用户协议、隐私政策等），不跳转外部浏览器。
//

import SwiftUI
import UIKit
import WebKit

/// 应用内 WebView，用于展示用户协议、隐私政策等页面
public struct InAppWebView: View {
    let url: URL
    let title: String

    public init(url: URL, title: String = "详情") {
        self.url = url
        self.title = title
    }

    public var body: some View {
        WebViewRepresentable(url: url)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
    }
}

private struct WebViewRepresentable: UIViewRepresentable {
    let url: URL

    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView()
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
