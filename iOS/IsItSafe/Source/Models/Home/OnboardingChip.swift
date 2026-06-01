//
//  OnboardingChip.swift
//  IsItSafe
//
//  V4-P1 冷启动引导：admin 配置的可点 chips
//  服务端按 X-App-Language 返对应语言；iOS 24h 缓存
//

import Foundation

public struct OnboardingChip: Codable, Identifiable, Equatable {
    public let id: String
    public let orderIdx: Int
    public let label: String
    public let iconType: String        // SF Symbol 名
    public let actionType: String      // text | image | camera | voice | url
    public let actionPayload: String?  // text → 发送的文案；url → 跳转路径
}

/// 兜底硬编码 chips：网络失败或首次启动时显示
/// 内容跟服务端 default 一致，让无网时也有体验
public enum FallbackOnboardingChips {
    public static func defaults(languageCode: String) -> [OnboardingChip] {
        let isEnglish = languageCode == "en"
        return [
            OnboardingChip(
                id: "fallback-1",
                orderIdx: 1,
                label: isEnglish ? "Check if this WeChat ID is safe?" : "看看这个微信号有没有问题？",
                iconType: "message.fill",
                actionType: "text",
                actionPayload: isEnglish ? "Check if this WeChat ID is safe?" : "看看这个微信号有没有问题？"
            ),
            OnboardingChip(
                id: "fallback-2",
                orderIdx: 2,
                label: isEnglish ? "Police calling about my bank card, is it real?" : "派出所打电话查我银行卡，是真的吗？",
                iconType: "shield.lefthalf.filled",
                actionType: "text",
                actionPayload: isEnglish ? "Police calling about my bank card, is it real?" : "派出所打电话查我银行卡，是真的吗？"
            ),
            OnboardingChip(
                id: "fallback-3",
                orderIdx: 3,
                label: isEnglish ? "Can I trust the \"insider investment\" in WeChat group?" : "群里推荐的内幕投资能信吗？",
                iconType: "chart.line.uptrend.xyaxis",
                actionType: "text",
                actionPayload: isEnglish ? "Can I trust the \"insider investment\" in WeChat group?" : "群里推荐的内幕投资能信吗？"
            ),
            OnboardingChip(
                id: "fallback-4",
                orderIdx: 4,
                label: isEnglish ? "Send me a suspicious screenshot" : "拍可疑截图给我看",
                iconType: "camera.fill",
                actionType: "image",
                actionPayload: nil
            ),
        ]
    }
}
