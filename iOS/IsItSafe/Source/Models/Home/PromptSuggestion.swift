//
//  PromptSuggestion.swift
//  IsItSafe
//
//  首页提示词：对应查询类型（电话/链接/公司/文本/截图），作为「聊聊新话题」示例。
//

import Foundation

public enum PromptSuggestion {
    public static let title = "聊聊新话题"

    /// 与查询类型对应的示例提示词，用于首页展示
    public static let items: [String] = [
        "这个电话号码是诈骗电话吗？",
        "这个链接/网址安全吗？",
        "某某公司/平台靠谱吗？有风险吗？",
        "对方让我转账到安全账户，是骗局吗？",
        "发一张截图帮我识别有没有风险",
        "有人推荐高收益理财，可信吗？",
        "这个客服电话是官方的吗？",
        "收到中奖/贷款短信，是诈骗吗？",
    ]
}
