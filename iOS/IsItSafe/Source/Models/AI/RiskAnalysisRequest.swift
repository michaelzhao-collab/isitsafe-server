//
//  RiskAnalysisRequest.swift
//  IsItSafe
//

import Foundation

public struct RiskAnalysisRequest: Encodable {
    public let content: String
    public let language: String?
    public let country: String?
    /// 同一对话内连续提问时传上次返回的 conversation_id
    public let conversationId: String?
    /// 上轮对话内容，追问时提供上下文（[["role":"user","content":"..."],["role":"assistant","content":"..."]]）
    public let context: [[String: String]]?

    public init(content: String, language: String? = "zh", country: String? = nil, conversationId: String? = nil, context: [[String: String]]? = nil) {
        self.content = content
        self.language = language
        self.country = country
        self.conversationId = conversationId
        self.context = context
    }

    enum CodingKeys: String, CodingKey {
        case content
        case language
        case country
        case conversationId = "conversation_id"
        case context
    }
}
