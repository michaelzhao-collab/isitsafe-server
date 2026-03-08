//
//  ScreenshotAnalyzeRequest.swift
//  IsItSafe
//

import Foundation

public struct ScreenshotAnalyzeRequest: Encodable {
    public let content: String
    public let language: String?
    public let isScreenshot: Bool?
    /// 用户上传截图后的 CDN 地址，供服务端落库与后台展示
    public let imageUrl: String?

    public init(content: String, language: String? = "zh", isScreenshot: Bool? = true, imageUrl: String? = nil) {
        self.content = content
        self.language = language
        self.isScreenshot = isScreenshot
        self.imageUrl = imageUrl
    }
}
