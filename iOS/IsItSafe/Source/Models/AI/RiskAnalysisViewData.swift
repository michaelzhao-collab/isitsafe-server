//
//  RiskAnalysisViewData.swift
//  IsItSafe
//
//  用于 UI 展示的转换结构。
//

import Foundation

public struct RiskAnalysisViewData {
    public let riskLevel: String
    public let confidence: Int
    public let riskType: [String]
    public let summary: String
    public let reasons: [String]
    public let advice: [String]
    public let score: Int?
    /// 当前对话 id，同对话内下次提问时传回
    public let conversationId: String?
    /// true 表示追问/闲聊回复，只展示 summary 文字气泡，不显示风险卡片
    public let isConversational: Bool

    // ====== V3 #5 意图分流 ======
    /// 服务端 intent；非 nil 且 != "scam_detection" 时走文本气泡路径
    public let intent: String?
    /// scam_detection 专用：'scam' | 'safe' | 'unknown'
    public let verdict: String?
    /// 3-5 句决策性建议（新版风险卡）
    public let steps: [String]
    /// 可点动作按钮
    public let actions: [RiskAnalysisResult.ResponseAction]
    /// general_chat / fallback 时的自由文本
    public let freeText: String?

    /// 是否走非检测渲染（聊天气泡 / 知识列表 / 应急步骤），而非红黄绿风险卡
    public var isNonDetection: Bool {
        guard let i = intent else { return isConversational }
        return i != "scam_detection"
    }

    /// 是否隐藏「分享到家庭 / 举报 / 加入风险库」等仅对 scam_detection 才有意义的操作
    public var hidesScamOnlyActions: Bool {
        if let i = intent, i == "general_chat" { return true }
        return isConversational
    }

    public init(from result: RiskAnalysisResult) {
        riskLevel = result.riskLevel ?? "unknown"
        confidence = result.confidence ?? 0
        riskType = result.riskType ?? []
        summary = result.summary ?? ""
        reasons = result.reasons ?? []
        advice = result.advice ?? []
        score = result.score
        conversationId = result.conversationId
        isConversational = result.isConversational ?? false
        intent = result.intent
        verdict = result.verdict
        steps = result.steps ?? []
        actions = result.actions ?? []
        freeText = result.freeText
    }

    /// 图片中未识别到文字时，展示与正常分析一致的卡片，不报错
    public static let imageContentNotRecognized: RiskAnalysisViewData = {
        RiskAnalysisViewData(
            riskLevel: "unknown",
            confidence: 0,
            riskType: ["未知风险"],
            summary: "图片内容无法识别",
            reasons: [
                "图片中未识别到可分析文字",
                "当前无法对纯图片内容进行风险分析",
                "可尝试上传包含文字的截图或直接输入文字",
            ],
            advice: [
                "请上传包含文字的图片以便分析",
                "或直接输入您要检测的文字内容",
                "如有疑问可联系客服",
            ],
            score: nil,
            conversationId: nil
        )
    }()

    public init(riskLevel: String, confidence: Int, riskType: [String], summary: String, reasons: [String], advice: [String], score: Int?, conversationId: String? = nil, isConversational: Bool = false, intent: String? = nil, verdict: String? = nil, steps: [String] = [], actions: [RiskAnalysisResult.ResponseAction] = [], freeText: String? = nil) {
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

    public var riskLevelDisplay: String {
        // 直接使用服务端返回的 riskLevel 字段（如 high/medium/low/unknown），
        // 具体展示文案交给 UI 层根据 languageCode 再做本地化。
        return riskLevel
    }
}

