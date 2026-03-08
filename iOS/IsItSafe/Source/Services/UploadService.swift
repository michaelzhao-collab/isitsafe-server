//
//  UploadService.swift
//  IsItSafe
//
//  截图上传：上传到 OSS 返回 CDN URL，供分析接口落库与后台展示。
//

import Foundation

public final class UploadService {
    public static let shared = UploadService()

    private init() {}

    /// 上传截图到 OSS，返回 CDN URL（需登录）。失败时返回 nil，调用方可不传 imageUrl。
    public func uploadScreenshot(_ imageData: Data, mimeType: String = "image/jpeg") async -> String? {
        do {
            return try await NetworkManager.shared.uploadFile(
                type: "screenshot",
                imageData: imageData,
                mimeType: mimeType,
                filename: "screenshot-\(Int(Date().timeIntervalSince1970)).jpg"
            )
        } catch {
            return nil
        }
    }
}
