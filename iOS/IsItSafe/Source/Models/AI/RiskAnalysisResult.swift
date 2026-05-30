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

    // ====== V3 #5 意图分流（新字段，全可选，老服务端不返回时仍能解码）======
    /// 服务端 intent: 'scam_detection' | 'general_chat' | 'knowledge_query' | 'help_request'
    public let intent: String?
    /// scam_detection 专用：'scam' | 'safe' | 'unknown'
    public let verdict: String?
    /// 3-5 句决策性建议（新版风险卡）
    public let steps: [String]?
    /// 可点动作按钮
    public let actions: [ResponseAction]?
    /// general_chat 时的自由文本回答（服务端字段 free_text → freeText）
    public let freeText: String?

    public struct ResponseAction: Codable, Hashable {
        public let label: String
        public let type: String
        public let value: String?

        public init(label: String, type: String, value: String? = nil) {
            self.label = label
            self.type = type
            self.value = value
        }
    }

    /// 是否为非检测意图（chat / knowledge / help）——iOS 渲染时走文本气泡而非风险卡
    public var isNonDetection: Bool {
        guard let i = intent else { return false }
        return i != "scam_detection"
    }

    /// 显式 init（新字段默认为 nil，老调用站无需改动）
    public init(
        riskLevel: String? = nil,
        confidence: Int? = nil,
        riskType: [String]? = nil,
        summary: String? = nil,
        reasons: [String]? = nil,
        advice: [String]? = nil,
        score: Int? = nil,
        conversationId: String? = nil,
        isConversational: Bool? = nil,
        intent: String? = nil,
        verdict: String? = nil,
        steps: [String]? = nil,
        actions: [ResponseAction]? = nil,
        freeText: String? = nil
    ) {
        self.riskLevel = riskLevel
        self.confidence = confidence
        self.riskType = riskType
        self.summary = summary
        self.reasons = reasons
        self.advice = advice
        self.score = score
        self.conversationId = conversationId
        self.isConversational = isConversational
        self.intent = intent
        self.verdict = verdict
        self.steps = steps
        self.actions = actions
        self.freeText = freeText
    }
}
