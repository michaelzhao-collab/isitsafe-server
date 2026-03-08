//
//  MockData.swift
//  IsItSafe
//
//  预览用假数据，字段与接口返回格式一致，用于查看 App 整体布局与样式。
//

import Foundation

public enum MockData {
    private static let mockModeKey = "isitsafe.useMockData"

    /// 是否启用假数据模式（预览 App 时设为 true）
    public static var isMockModeEnabled: Bool {
        get { UserDefaults.standard.bool(forKey: mockModeKey) }
        set { UserDefaults.standard.set(newValue, forKey: mockModeKey) }
    }

    // MARK: - 假用户（与 GET /api/auth/userinfo 返回一致）
    public static let fakeUser = UserInfoResponse(
        id: "mock_user_001",
        phone: "138****8000",
        email: "demo@isitsafe.com",
        country: "CN",
        avatar: nil,
        nickname: "预览用户",
        gender: "male",
        birthday: "1995-03-12",
        role: "USER",
        lastLogin: ISO8601DateFormatter().string(from: Date()),
        createdAt: "2024-01-15T08:00:00.000Z",
        subscriptionStatus: "premium",
        subscriptionExpire: "2026-12-31"
    )

    // MARK: - 假历史记录（与 GET /api/queries 的 items 一致）
    private static let fakeResultHigh = RiskAnalysisResult(
        riskLevel: "high",
        confidence: 92,
        riskType: ["诈骗", "钓鱼网站"],
        summary: "该链接存在较高风险，疑似钓鱼或诈骗页面。",
        reasons: ["域名非常规", "与已知诈骗样本相似"],
        advice: ["切勿输入账号密码", "建议举报"],
        score: 88
    )
    private static let fakeResultMedium = RiskAnalysisResult(
        riskLevel: "medium",
        confidence: 65,
        riskType: ["投资骗局"],
        summary: "内容涉及高收益承诺，存在诱导投资风险。",
        reasons: ["承诺保本高收益", "无正规资质"],
        advice: ["谨慎对待", "核实平台资质"],
        score: 55
    )
    private static let fakeResultLow = RiskAnalysisResult(
        riskLevel: "low",
        confidence: 95,
        riskType: ["低风险"],
        summary: "未发现明显风险特征。",
        reasons: ["来源可信"],
        advice: ["保持警惕"],
        score: 15
    )

    public static let fakeHistoryItems: [QueryHistoryItem] = [
        QueryHistoryItem(
            id: "q_001",
            userId: "mock_user_001",
            inputType: "text",
            content: "https://xxx-fake-website.com/win",
            resultJson: fakeResultHigh,
            riskLevel: "high",
            confidence: 92,
            aiProvider: "doubao",
            createdAt: ISO8601DateFormatter().string(from: Date().addingTimeInterval(-3600))
        ),
        QueryHistoryItem(
            id: "q_002",
            userId: "mock_user_001",
            inputType: "phone",
            content: "+86 170 0000 8888",
            resultJson: fakeResultMedium,
            riskLevel: "medium",
            confidence: 65,
            aiProvider: "doubao",
            createdAt: ISO8601DateFormatter().string(from: Date().addingTimeInterval(-7200))
        ),
        QueryHistoryItem(
            id: "q_003",
            userId: "mock_user_001",
            inputType: "text",
            content: "某银行官方客服电话 95588",
            resultJson: fakeResultLow,
            riskLevel: "low",
            confidence: 95,
            aiProvider: "doubao",
            createdAt: ISO8601DateFormatter().string(from: Date().addingTimeInterval(-86400))
        ),
        QueryHistoryItem(
            id: "q_004",
            userId: "mock_user_001",
            inputType: "company",
            content: "某某高收益理财公司",
            resultJson: fakeResultMedium,
            riskLevel: "medium",
            confidence: 70,
            aiProvider: "doubao",
            createdAt: ISO8601DateFormatter().string(from: Date().addingTimeInterval(-172800))
        ),
    ]

    // MARK: - 假案例（与 GET /api/knowledge 的 items 一致）
    public static let fakeKnowledgeItems: [KnowledgeItem] = [
        KnowledgeItem(
            id: "k_001",
            title: "冒充公检法诈骗",
            category: "诈骗",
            content: "骗子冒充公安、检察院、法院工作人员，以涉嫌洗钱、涉案等为由，要求受害人将资金转入“安全账户”。请勿相信任何要求转账的“公检法”电话。",
            tags: ["公检法", "安全账户", "转账"],
            language: "zh",
            source: "防诈案例库",
            createdAt: "2024-06-01T00:00:00.000Z",
            updatedAt: nil
        ),
        KnowledgeItem(
            id: "k_002",
            title: "兼职刷单骗局",
            category: "兼职骗局",
            content: "以“点赞、刷单、做任务”为名，先小额返利取得信任，再以“连单”“系统卡单”等理由要求继续垫资，最终无法提现。所有刷单都是诈骗。",
            tags: ["刷单", "兼职", "垫资"],
            language: "zh",
            source: "防诈案例库",
            createdAt: "2024-06-02T00:00:00.000Z",
            updatedAt: nil
        ),
        KnowledgeItem(
            id: "k_003",
            title: "虚假投资理财",
            category: "投资骗局",
            content: "通过社交软件、荐股群等诱导下载虚假投资 App，承诺高额收益，初期可提现，后期以“缴税”“解冻”等理由阻止提现。投资请认准正规机构。",
            tags: ["投资", "理财", "高收益"],
            language: "zh",
            source: "防诈案例库",
            createdAt: "2024-06-03T00:00:00.000Z",
            updatedAt: nil
        ),
        KnowledgeItem(
            id: "k_004",
            title: "假客服退款诈骗",
            category: "假客服",
            content: "冒充电商或快递客服，以“商品有问题”“快递丢失”为由主动退款，诱导点击链接或提供验证码，从而盗刷资金。官方客服不会主动索要验证码。",
            tags: ["假客服", "退款", "验证码"],
            language: "zh",
            source: "防诈案例库",
            createdAt: "2024-06-04T00:00:00.000Z",
            updatedAt: nil
        ),
    ]
}
