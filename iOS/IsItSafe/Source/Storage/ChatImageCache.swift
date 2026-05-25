//
//  ChatImageCache.swift
//  IsItSafe
//
//  对话中用户上传的图片本地缓存，重启后从历史打开时优先显示缓存，避免只显示文案。
//

import CryptoKit
import Foundation
import UIKit

public final class ChatImageCache {
    public static let shared = ChatImageCache()
    private let fileManager = FileManager.default
    private let subdir = "ChatImages"
    private let maxCachedCount = 200

    private var cacheDirectory: URL? {
        guard let base = fileManager.urls(for: .cachesDirectory, in: .userDomainMask).first else { return nil }
        let dir = base.appendingPathComponent(subdir, isDirectory: true)
        if !fileManager.fileExists(atPath: dir.path) {
            try? fileManager.createDirectory(at: dir, withIntermediateDirectories: true)
        }
        return dir
    }

    private init() {}

    /// 将 URL 转为安全的文件名（稳定哈希）
    private func keyToFilename(_ key: String) -> String {
        let data = Data(key.utf8)
        let hash = SHA256.hash(data: data)
        return hash.map { String(format: "%02x", $0) }.joined() + ".jpg"
    }

    /// 缓存图片，key 一般为 imageUrl（CDN 地址）
    public func setImage(_ image: UIImage?, forKey key: String) {
        guard !key.isEmpty,
              let image = image,
              let data = image.jpegData(compressionQuality: 0.85),
              let dir = cacheDirectory else { return }
        let fileURL = dir.appendingPathComponent(keyToFilename(key))
        try? data.write(to: fileURL)
        trimIfNeeded()
    }

    /// 从缓存读取图片
    public func getImage(forKey key: String) -> UIImage? {
        guard !key.isEmpty, let dir = cacheDirectory else { return nil }
        let fileURL = dir.appendingPathComponent(keyToFilename(key))
        guard fileManager.fileExists(atPath: fileURL.path),
              let data = try? Data(contentsOf: fileURL),
              let image = UIImage(data: data) else { return nil }
        return image
    }

    private func trimIfNeeded() {
        guard let dir = cacheDirectory,
              let contents = try? fileManager.contentsOfDirectory(at: dir, includingPropertiesForKeys: [.contentModificationDateKey], options: .skipsHiddenFiles),
              contents.count > maxCachedCount else { return }
        let sorted = contents.sorted { url1, url2 in
            let d1 = (try? url1.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast
            let d2 = (try? url2.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast
            return d1 < d2
        }
        for url in sorted.prefix(contents.count - maxCachedCount) {
            try? fileManager.removeItem(at: url)
        }
    }
}
