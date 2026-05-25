//
//  CachedNetworkImageView.swift
//  IsItSafe
//
//  先读本地缓存再网络加载，加载成功后写入缓存，重启后从历史打开时能显示图片。
//

import SwiftUI
import UIKit

public struct CachedNetworkImageView: View {
    let urlString: String
    let maxWidth: CGFloat
    let maxHeight: CGFloat

    @State private var loadedImage: UIImage?
    @State private var loadFailed = false

    public init(urlString: String, maxWidth: CGFloat = 200, maxHeight: CGFloat = 160) {
        self.urlString = urlString
        self.maxWidth = maxWidth
        self.maxHeight = maxHeight
    }

    public var body: some View {
        Group {
            if let img = loadedImage {
                Image(uiImage: img)
                    .resizable()
                    .scaledToFit()
            } else if loadFailed {
                VStack(spacing: 6) {
                    Image(systemName: "photo")
                        .font(.title2)
                        .foregroundColor(.secondary)
                    Text(failureCaption)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
                .frame(width: maxWidth, height: maxHeight)
                .background(Color(.secondarySystemBackground))
            } else {
                ProgressView()
                    .frame(width: maxWidth, height: maxHeight)
            }
        }
        .frame(maxWidth: maxWidth, maxHeight: maxHeight)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .accessibilityLabel(loadFailed ? Text(failureCaption) : Text("图片"))
        .task(id: urlString) {
            await loadAndCache()
        }
    }

    private var failureCaption: String {
        // 与首页其他文案保持中文为主，简短直接
        "图片加载失败"
    }

    private func loadAndCache() async {
        if let cached = ChatImageCache.shared.getImage(forKey: urlString) {
            await MainActor.run { loadedImage = cached; loadFailed = false }
            return
        }
        guard let url = URL(string: urlString) else {
            await MainActor.run { loadedImage = nil; loadFailed = true }
            return
        }
        // 用专用 URLSession，避免共享 session 的长默认超时（60s+）卡住整屏
        // 请求 5s / 资源 10s 足以覆盖大部分图片场景；CDN 命中通常 <1s
        let session = Self.imageSession
        do {
            let (data, _) = try await session.data(from: url)
            guard let img = UIImage(data: data) else {
                await MainActor.run { loadedImage = nil; loadFailed = true }
                return
            }
            ChatImageCache.shared.setImage(img, forKey: urlString)
            await MainActor.run { loadedImage = img; loadFailed = false }
        } catch {
            await MainActor.run { loadedImage = nil; loadFailed = true }
        }
    }

    /// 图片专用 session：短超时 + 走系统缓存，避免阻塞 UI
    private static let imageSession: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 5    // 单次连接 5s
        config.timeoutIntervalForResource = 10  // 整次资源 10s
        config.requestCachePolicy = .returnCacheDataElseLoad
        config.urlCache = URLCache(memoryCapacity: 16 * 1024 * 1024, diskCapacity: 64 * 1024 * 1024, diskPath: "isitsafe-image-cache")
        return URLSession(configuration: config)
    }()
}
