//
//  ScreenshotAnalyzeRequest.swift
//  IsItSafe
//

import Foundation

public struct ScreenshotAnalyzeRequest: Encodable {
    public let content: String
    public let language: String?
    public let isScreenshot: Bool?
    public let imageUrl: String?
    public let conversationId: String?
    /// 上轮对话内容，追问时提供上下文
    public let context: [[String: String]]?

    public init(content: String, language: String? = "zh", isScreenshot: Bool? = true, imageUrl: String? = nil, conversationId: String? = nil, context: [[String: String]]? = nil) {
        self.content = content
        self.language = language
        self.isScreenshot = isScreenshot
        self.imageUrl = imageUrl
        self.conversationId = conversationId
        self.context = context
    }

    enum CodingKeys: String, CodingKey {
        case content
        case language
        case isScreenshot
        case imageUrl
        case conversationId = "conversation_id"
        case context
    }
}
