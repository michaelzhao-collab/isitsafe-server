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
    /// 点击全屏看图。默认关：列表缩略图（如知识库）点击应进入详情，不能被看图抢走
    let tapToView: Bool
    let cornerRadius: CGFloat

    @State private var loadedImage: UIImage?
    @State private var loadFailed = false

    public init(urlString: String, maxWidth: CGFloat = 200, maxHeight: CGFloat = 160,
                tapToView: Bool = false, cornerRadius: CGFloat = 12) {
        self.urlString = urlString
        self.maxWidth = maxWidth
        self.maxHeight = maxHeight
        self.tapToView = tapToView
        self.cornerRadius = cornerRadius
    }

    public var body: some View {
        Group {
            if let img = loadedImage {
                // 2026-10-06：按原图比例算出确切尺寸再裁圆角。原来圆角加在外层 max 框上，
                // 竖图缩放后比框窄，圆角落在图片外的空白处 → 看起来是直角
                let size = Self.fittedSize(img.size, maxWidth: maxWidth, maxHeight: maxHeight)
                Image(uiImage: img)
                    .resizable()
                    .scaledToFit()
                    .frame(width: size.width, height: size.height)
                    .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
                    .tapToViewImage(tapToView ? img : nil)
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
                .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            } else {
                ProgressView()
                    .frame(width: maxWidth, height: maxHeight)
            }
        }
        .accessibilityLabel(loadFailed ? Text(failureCaption) : Text("图片"))
        .task(id: urlString) {
            await loadAndCache()
        }
    }

    /// 等比缩放到不超过 maxWidth × maxHeight 的确切尺寸
    static func fittedSize(_ size: CGSize, maxWidth: CGFloat, maxHeight: CGFloat) -> CGSize {
        guard size.width > 0, size.height > 0 else { return CGSize(width: maxWidth, height: maxHeight) }
        let scale = min(maxWidth / size.width, maxHeight / size.height, 1)
        return CGSize(width: size.width * scale, height: size.height * scale)
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
