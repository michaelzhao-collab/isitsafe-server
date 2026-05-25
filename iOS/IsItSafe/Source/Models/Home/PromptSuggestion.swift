//
//  PromptSuggestion.swift
//  IsItSafe
//
//  首页提示词：对应查询类型（电话/链接/公司/文本/截图），作为「聊聊新话题」示例。
//

import Foundation

public enum PromptSuggestion {
    public static func title(languageCode: String) -> String {
        languageCode == "en" ? "Try asking…" : "聊聊新话题"
    }

    public static func items(languageCode: String) -> [String] {
        if languageCode == "en" {
            return [
                "Is this phone number a scam?",
                "Is this link/URL safe?",
                "Is this company/platform trustworthy?",
                "They asked me to transfer to a 'safe account'. Is it a scam?",
                "Send a screenshot and I'll check for hidden risks",
                "Someone recommended a high-return investment. Is it legit?",
                "Is this customer service number official?",
                "I got a 'you won a prize' or loan SMS. Is it a scam?",
            ]
        }
        return [
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
}
