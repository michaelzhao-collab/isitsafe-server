//
//  LocalDefaultQAContent.swift
//  IsItSafe
//
//  冷启动默认 3 组问答：全部本地写死，不走服务器。
//

import Foundation

import UIKit

public enum LocalDefaultQAContent {
    public static func defaultTurns(languageCode: String) -> [ChatTurn] {
        let isEnglish = languageCode == "en"

        // 1
        let q1 = isEnglish ? "Someone asked me to send money. Scam?"
            : "有人让我转钱，这是诈骗吗？"
        let r1 = makeAnalysis(
            riskLevel: "high",
            confidence: 90,
            score: 90,
            summary: isEnglish ? "Likely a scam risk" : "存在较高诈骗风险",
            reasons: isEnglish ? [
                "Urgent request for money",
                "Unknown or unverified identity",
                "Pressure to act quickly"
            ] : [
                "紧急要求转账",
                "身份无法核实",
                "催促你快速操作"
            ],
            advice: isEnglish ? [
                "Do NOT send any money",
                "Verify through official channels",
                "Stop communication if unsure"
            ] : [
                "不要转账",
                "通过官方渠道核实",
                "如有疑虑立即停止沟通"
            ]
        )

        // 2
        let q2 = isEnglish ? "This investment looks too good. Safe?"
            : "这个投资看起来太好了，靠谱吗？"
        let r2 = makeAnalysis(
            riskLevel: "high",
            confidence: 95,
            score: 95,
            summary: isEnglish ? "High scam risk" : "高风险诈骗特征",
            reasons: isEnglish ? [
                "Promises unusually high returns",
                "Lacks transparent or verifiable details",
                "Creates urgency to invest quickly"
            ] : [
                "承诺异常高收益",
                "信息不透明或无法验证",
                "催促你快速投资"
            ],
            advice: isEnglish ? [
                "Do not invest immediately",
                "Research the platform independently",
                "Avoid sending money to unknown accounts"
            ] : [
                "不要立即投资",
                "独立核实平台信息",
                "避免向陌生账户转账"
            ]
        )

        // 3
        let q3 = isEnglish ? "Is this link safe?"
            : "这个链接安全吗？"
        let r3 = makeAnalysis(
            riskLevel: "medium",
            confidence: 60,
            score: 60,
            summary: isEnglish ? "This link may be risky" : "该链接可能存在风险",
            reasons: isEnglish ? [
                "Unknown or suspicious domain",
                "Possible phishing patterns",
                "No trusted source indication"
            ] : [
                "域名不明或可疑",
                "可能存在钓鱼特征",
                "缺乏可信来源"
            ],
            advice: isEnglish ? [
                "Do not click or enter info",
                "Check official website instead",
                "Avoid logging in through this link"
            ] : [
                "不要点击或填写信息",
                "通过官网核实",
                "避免通过该链接登录"
            ]
        )

        return [
            ChatTurn(userText: q1, userImage: nil, status: .done(.analysis(r1))),
            ChatTurn(userText: q2, userImage: nil, status: .done(.analysis(r2))),
            ChatTurn(userText: q3, userImage: nil, status: .done(.analysis(r3)))
        ]
    }

    private static func makeAnalysis(
        riskLevel: String,
        confidence: Int,
        score: Int,
        summary: String,
        reasons: [String],
        advice: [String]
    ) -> RiskAnalysisViewData {
        // 这里用本地常量填充 RiskResultCard 所需字段：
        // - riskLevel 决定头部底色与「高/中/低风险」文案
        // - score 决定头部「Score/得分」
        // - summary/reasons/advice 决定正文卡片内容
        return RiskAnalysisViewData(
            riskLevel: riskLevel,
            confidence: confidence,
            riskType: [],
            summary: summary,
            reasons: reasons,
            advice: advice,
            score: score,
            conversationId: nil
        )
    }
}

