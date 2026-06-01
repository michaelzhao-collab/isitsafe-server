//
//  OnboardingChip.swift
//  IsItSafe
//
//  V4-P1 冷启动引导：admin 配置的可点 chips
//  服务端按 X-App-Language 返对应语言；iOS 24h 缓存
//  HomeContainerView 每次新对话从全量池里随机取 4 个展示
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
/// 内容跟服务端 seed 一致，让无网时也有体验
/// HomeContainerView 从这个池子里随机抽 4 个展示
public enum FallbackOnboardingChips {
    public static func defaults(languageCode: String) -> [OnboardingChip] {
        let isEnglish = languageCode == "en"
        let raw: [(String, String, String, String, String, String?)] = [
            // (id, icon, actionType, labelZh, labelEn, payloadZh / payloadEn nil if not text/url)
            // —— 通用诈骗类（最高频 5 条）——
            ("fb-1", "message.fill", "text",
             "看看这个微信号有没有问题？",
             "Check if this WeChat ID is safe?",
             nil),
            ("fb-2", "shield.lefthalf.filled", "text",
             "派出所打电话查我银行卡，是真的吗？",
             "Police calling about my bank card — is it real?",
             nil),
            ("fb-3", "chart.line.uptrend.xyaxis", "text",
             "群里推荐的内幕投资能信吗？",
             "Can I trust an \"insider investment\" tip from a group?",
             nil),
            ("fb-4", "camera.fill", "image",
             "拍可疑截图给我看",
             "Send me a suspicious screenshot",
             nil),
            ("fb-5", "envelope.badge", "text",
             "这条短信里的链接能点吗？",
             "Is the link in this SMS safe to click?",
             nil),
            // —— 电话/号码类 ——
            ("fb-6", "phone.fill", "text",
             "陌生号码打来说我中奖了",
             "A stranger called saying I won a prize",
             nil),
            ("fb-7", "phone.down.fill", "text",
             "+86 开头的国际电话靠谱吗？",
             "Is this international call number trustworthy?",
             nil),
            // —— 网购/退款类 ——
            ("fb-8", "shippingbox.fill", "text",
             "快递说包裹有问题要赔我钱",
             "Courier says my package has a problem and wants to refund me",
             nil),
            ("fb-9", "creditcard.fill", "text",
             "客服让我先付一笔保证金",
             "Customer service wants me to pay a \"deposit\" first",
             nil),
            // —— 仿冒身份类 ——
            ("fb-10", "person.badge.shield.checkmark", "text",
             "自称银行客服让我转账到\"安全账户\"",
             "\"Bank rep\" wants me to transfer to a \"safe account\"",
             nil),
            ("fb-11", "person.crop.circle.badge.exclamationmark", "text",
             "亲戚突然借钱说很急，怎么核实？",
             "A relative suddenly asks to borrow money urgently — how to verify?",
             nil),
            // —— 视频/语音/AI 类 ——
            ("fb-12", "waveform", "text",
             "电话里声音像家人但感觉怪怪的",
             "Phone caller sounds like family but feels off",
             nil),
            // —— 工作/兼职类 ——
            ("fb-13", "briefcase.fill", "text",
             "兼职刷单先垫付能做吗？",
             "Is \"task-rebate\" side gig with upfront payment legit?",
             nil),
            // —— 红包/中奖类 ——
            ("fb-14", "gift.fill", "text",
             "扫码领红包要填身份证",
             "QR code to claim a gift asks for my ID number",
             nil),
        ]
        return raw.enumerated().map { (idx, t) in
            OnboardingChip(
                id: t.0,
                orderIdx: idx + 1,
                label: isEnglish ? t.4 : t.3,
                iconType: t.1,
                actionType: t.2,
                actionPayload: t.2 == "text" ? (isEnglish ? t.4 : t.3) : t.5
            )
        }
    }
}
