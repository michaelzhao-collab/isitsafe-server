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
/// 跟服务端 seed 内容一致（46 条），HomeContainerView 随机抽 4 个展示
public enum FallbackOnboardingChips {
    public static func defaults(languageCode: String) -> [OnboardingChip] {
        let isEnglish = languageCode == "en"
        // (id, icon, actionType, labelZh, labelEn, payloadZh / payloadEn nil if not text/url)
        let raw: [(String, String, String, String, String, String?)] = [
            // —— 通用诈骗类（最高频）——
            ("fb-1", "message.fill", "text",
             "看看这个微信号有没有问题？",
             "Check if this WeChat ID is safe?",
             nil),
            ("fb-4", "camera.fill", "image",
             "拍可疑截图给我看",
             "Send me a suspicious screenshot",
             nil),
            ("fb-6", "phone.fill", "text",
             "陌生号码打来说我中奖了",
             "A stranger called saying I won a prize",
             nil),
            ("fb-7", "phone.down.fill", "text",
             "+86 开头的国际电话靠谱吗？",
             "Is this international call number trustworthy?",
             nil),
            ("fb-12", "waveform", "text",
             "电话里声音像家人但感觉怪怪的",
             "Phone caller sounds like family but feels off",
             nil),

            // A. 冒充官方/公检法/客服
            ("a1", "shield.lefthalf.filled", "text",
             "自称\"公安局\"打电话说我涉嫌洗钱怎么办？",
             "\"Police\" called saying I'm suspected of money laundering, what should I do?",
             nil),
            ("a2", "shield.lefthalf.filled", "text",
             "派出所要我把钱转到\"安全账户\"",
             "Police want me to transfer money to a \"safe account\"",
             nil),
            ("a3", "shield.lefthalf.filled", "text",
             "\"网警\"让我下载远程控制 App 配合调查",
             "\"Cybercrime officer\" wants me to install remote-control app for investigation",
             nil),
            ("a4", "person.badge.shield.checkmark", "text",
             "银行客服打来要我读验证码核实",
             "Bank rep called asking me to read the verification code",
             nil),
            ("a5", "creditcard.fill", "text",
             "客户经理说我贷款过了，先付 3000 服务费",
             "Loan officer says my loan is approved, asks for 3000 service fee first",
             nil),
            ("a6", "phone.fill", "text",
             "自称医院说孩子出车祸要急救费",
             "\"Hospital\" calling says my child had an accident and needs emergency fee",
             nil),

            // B. 投资理财类
            ("b1", "chart.line.uptrend.xyaxis", "text",
             "群里\"老师\"带单几次都准，让我充 5 万跟单",
             "Group \"mentor\" hit several trades, asks me to deposit 50K to follow",
             nil),
            ("b2", "chart.line.uptrend.xyaxis", "text",
             "有人推荐 80% 收益的\"量化项目\"靠谱吗？",
             "Someone pitching a \"quant project\" with 80% return — is it real?",
             nil),
            ("b3", "chart.line.uptrend.xyaxis", "text",
             "让我下载一个海外股票 App 投资",
             "They want me to install an overseas stock-trading app",
             nil),
            ("b4", "chart.line.uptrend.xyaxis", "text",
             "数字货币交易所先充值再返佣金",
             "Crypto exchange wants me to deposit first and \"earn commission\"",
             nil),
            ("b5", "chart.line.uptrend.xyaxis", "text",
             "\"内部炒股群\"先免费体验 7 天",
             "\"Insider trading group\" offers a free 7-day trial",
             nil),

            // C. 网购/退款
            ("c1", "shippingbox.fill", "text",
             "客服说我商品质量问题要赔我钱，让我加 QQ",
             "\"Support\" says my item has defects and wants to refund — asks me to add QQ",
             nil),
            ("c2", "shippingbox.fill", "text",
             "快递员说包裹丢了要赔我 3 倍",
             "Courier says my package is lost and offers 3x compensation",
             nil),
            ("c3", "shippingbox.fill", "text",
             "退款客服让我开屏幕共享操作",
             "\"Refund support\" wants me to share my screen",
             nil),
            ("c4", "creditcard.fill", "text",
             "商家说扫码退款要填银行卡密码",
             "Merchant asks me to scan a QR and enter my bank card PIN to get refund",
             nil),

            // D. 短信链接
            ("d1", "envelope.badge", "text",
             "短信说 ETC 即将失效，要点链接更新",
             "SMS says my ETC pass is about to expire — must click link to renew",
             nil),
            ("d2", "envelope.badge", "text",
             "短信说我手机欠费停机，链接缴费",
             "SMS says my phone will be cut off for unpaid bill — link to pay",
             nil),
            ("d3", "envelope.badge", "text",
             "短信带链接说我\"支付宝异地登录\"安全吗？",
             "SMS with link says \"Alipay logged in from another location\" — safe?",
             nil),
            ("d4", "envelope.badge", "text",
             "短信说\"积分即将到期\"要点链接兑换",
             "SMS says my \"points are expiring soon\" — click to redeem",
             nil),
            ("d5", "shippingbox.fill", "text",
             "顺丰快递通知说有\"待取件\"短信带链接",
             "SF Express SMS says \"package waiting for pickup\" with a link",
             nil),

            // E. 冒充亲友/同事
            ("e1", "person.crop.circle.badge.exclamationmark", "text",
             "儿子用陌生号码发\"我手机丢了\"借 5000",
             "My son texted from an unknown number \"I lost my phone, lend me 5000\"",
             nil),
            ("e2", "person.crop.circle.badge.exclamationmark", "text",
             "老板深夜微信让我紧急转账给客户",
             "My boss messaged late at night asking me to wire money to a client",
             nil),
            ("e3", "envelope.badge", "text",
             "同事让我帮忙接收一个验证码",
             "A coworker asks me to receive a verification code for them",
             nil),
            ("e4", "message.fill", "text",
             "微信加我说是高中同学要借钱",
             "A WeChat add says they're an old classmate and wants to borrow money",
             nil),

            // F. 红包/中奖/活动
            ("f1", "gift.fill", "text",
             "扫码领 200 元红包要填身份证号",
             "Scan a QR for a 200 RMB gift — they want my ID number",
             nil),
            ("f2", "gift.fill", "text",
             "集 8 张卡瓜分 100 万的活动靠谱吗？",
             "\"Collect 8 cards to split 1M RMB\" — is it real?",
             nil),
            ("f3", "chart.line.uptrend.xyaxis", "text",
             "中签新股要先付 5000 元保证金",
             "I \"won an IPO lottery\" but need to pay 5000 RMB deposit first",
             nil),

            // G. 兼职刷单/招聘
            ("g1", "briefcase.fill", "text",
             "京东兼职刷单先垫付返佣金能做吗？",
             "\"JD task-rebate\" side gig with upfront payment — legit?",
             nil),
            ("g2", "briefcase.fill", "text",
             "抖音点赞员日结工资先做任务",
             "\"TikTok like-clicker\" with daily pay — must do tasks first",
             nil),
            ("g3", "briefcase.fill", "text",
             "招聘说手机就能做网络兼职",
             "Recruitment ad says I can do online gig work from my phone",
             nil),

            // H. 情感/网恋诈骗
            ("h1", "person.crop.circle.badge.exclamationmark", "text",
             "网上认识的外国人寄包裹要我付清关费",
             "An overseas friend I met online sent a package — wants me to pay customs",
             nil),
            ("h2", "person.crop.circle.badge.exclamationmark", "text",
             "网恋对象推荐我跟他一起投资",
             "My online romantic partner wants me to invest together with them",
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
