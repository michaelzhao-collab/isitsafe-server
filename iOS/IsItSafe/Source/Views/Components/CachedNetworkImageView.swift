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
                Image(systemName: "photo")
                    .font(.title)
                    .foregroundColor(.secondary)
                    .frame(width: maxWidth, height: maxHeight)
            } else {
                ProgressView()
                    .frame(width: maxWidth, height: maxHeight)
            }
        }
        .frame(maxWidth: maxWidth, maxHeight: maxHeight)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .task(id: urlString) {
            await loadAndCache()
        }
    }

    private func loadAndCache() async {
        if let cached = ChatImageCache.shared.getImage(forKey: urlString) {
            await MainActor.run { loadedImage = cached; loadFailed = false }
            return
        }
        guard let url = URL(string: urlString),
              let (data, _) = try? await URLSession.shared.data(from: url),
              let img = UIImage(data: data) else {
            await MainActor.run { loadedImage = nil; loadFailed = true }
            return
        }
        ChatImageCache.shared.setImage(img, forKey: urlString)
        await MainActor.run { loadedImage = img; loadFailed = false }
    }
}
