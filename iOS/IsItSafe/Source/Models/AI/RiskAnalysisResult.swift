//
//  RiskAnalysisResult.swift
//  IsItSafe
//
//  与 server 统一 AI 返回 JSON 一致。字段全可选，兼容后端下划线/驼峰及缺字段的旧数据。
//

import Foundation

public struct RiskAnalysisResult: Codable {
    public let riskLevel: String?
    public let confidence: Int?
    public let riskType: [String]?
    public let summary: String?
    public let reasons: [String]?
    public let advice: [String]?
    public let score: Int?
    /// 当前对话 id，下次同对话提问时传回，历史按会话只显示一条（服务端字段 conversation_id，keyDecodingStrategy 转成 conversationId）
    public let conversationId: String?
    /// true 表示追问/闲聊回复，仅展示 summary 文字气泡，不显示风险卡片（服务端字段 is_conversational）
    public let isConversational: Bool?
}
