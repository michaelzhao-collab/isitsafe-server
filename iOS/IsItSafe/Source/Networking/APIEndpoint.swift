//
//  APIEndpoint.swift
//  IsItSafe
//
//  所有 iOS 使用的接口枚举，路径与 server 完全一致。
//

import Foundation

public enum APIEndpoint {
    case health
    case authLogin
    case authAppleLogin
    case authSendCode
    case authRegionHint
    case authLogout
    case authDeleteAccount
    /// S3-5 数据导出（GDPR / 个保法 right of access）
    case authExportData
    case authUserInfo
    case authRefreshToken
    case aiAnalyze
    case aiAnalyzeScreenshot
    case queryPhone
    case queryURL
    case queryCompany
    case queryHistory(page: Int, pageSize: Int, riskLevel: String?, conversationId: String?)
    case deleteQuery(id: String)
    case deleteQueryConversation(conversationId: String)
    case queryTags
    case reportSubmit
    case knowledgeList(category: String?, page: Int, pageSize: Int, search: String?, language: String?)
    case knowledgeCategories(language: String)
    case knowledgeDetail(id: String)
    case subscriptionVerify
    case subscriptionStatus
    case membershipPlans
    case uploadAvatar
    case uploadFile
    case updateProfile
    case messagesList(page: Int, pageSize: Int)
    case messageUnreadCount
    case messageMarkRead(id: String)
    case feedbackSubmit
    case publicConfig

    // ====== V3 一期 ======
    /// V3-E 心跳上报（关怀机制依赖）
    case v3UserHeartbeat
    /// V3-J 长辈模式开关（自己开/关）
    case v3UserElderMode
    /// V3-S1-5 推送设备登记（APNs device token 上报）
    case v3UserRegisterDevice
    /// V3-E 创建家庭组（免费）
    case v3FamilyCreateGroup
    /// V3-E 我的家庭组（兼容旧版：返回单一最早加入的）
    case v3FamilyGetMyGroup
    /// V3-E S5-10 多家庭：拉取我加入的全部家庭组
    case v3FamilyGetMyGroups
    /// V3-E 生成邀请码
    case v3FamilyGenerateInvite(groupId: String)
    /// V3-E 兑换邀请码
    case v3FamilyRedeemInvite
    /// V3-E 退出家庭组
    case v3FamilyLeaveGroup(groupId: String)
    /// V3-E 解散家庭组（owner）
    case v3FamilyDissolveGroup(groupId: String)
    /// V3-E 移除成员（owner）
    case v3FamilyRemoveMember(groupId: String, userId: String)
    /// V3-E 更新隐私偏好
    case v3FamilyUpdatePreferences
    /// V3-E 主动分享触发官方广播（W5 完整实现）
    case v3FamilyCreateBroadcast
    /// V3-E 拉取家庭官方消息
    case v3FamilyGetBroadcasts(limit: Int)
    /// V3-E 成员活跃状态
    case v3FamilyGetMembersStatus
    /// V3-E S4-3 监护人远程开启被监护人长辈模式
    case v3FamilyMemberElderMode(userId: String)
    /// V3-E S5-12 改自己在该家庭组里的称呼（全员可见）
    case v3FamilySetMyDisplayName(groupId: String)
    /// V3-E S5-12 给某成员设私人备注（仅自己可见）
    case v3FamilySetAlias(memberId: String)

    // V3-B 情报推送
    /// 情报 feed
    case v3IntelFeed(limit: Int, language: String?)
    /// 单条详情
    case v3IntelDetail(id: String)
    /// 分类列表
    case v3IntelCategories(language: String?)
    /// 未读数（首页通知条用）
    case v3IntelUnreadCount
    /// 上报情报
    case v3IntelSubmit
    /// 我的上报
    case v3IntelMySubmissions
    /// 获取偏好
    case v3IntelGetPreferences
    /// 更新偏好
    case v3IntelPutPreferences

    // V3-A1 语音深伪
    case v3DeepfakeCreate
    case v3DeepfakeResult(taskId: String)
    case v3DeepfakeHistory(limit: Int)
    case v3DeepfakeDelete(taskId: String)
    case v3DeepfakeFeedback(taskId: String)
    /// V3-A1 一键广播深伪结果到家庭（S2-4）
    case v3DeepfakeBroadcast(taskId: String)
    /// V3-A1 SSE 实时结果推送（S2-5，PRD"WS /ws/deepfake"实质用 SSE）
    case v3DeepfakeStream(taskId: String)

    // V3-F 暗网监控
    case v3BreachAddTarget
    case v3BreachListTargets
    case v3BreachDeleteTarget(id: String)
    case v3BreachListAlerts
    case v3BreachDismissAlert(id: String)

    public var path: String {
        switch self {
        case .health: return "/api/health"
        case .authLogin: return "/api/auth/login"
        case .authAppleLogin: return "/api/auth/apple/login"
        case .authSendCode: return "/api/auth/send-sms-code"
        case .authRegionHint: return "/api/auth/region-hint"
        case .authLogout: return "/api/auth/logout"
        case .authDeleteAccount: return "/api/auth/delete-account"
        case .authExportData: return "/api/auth/export-data"
        case .authUserInfo: return "/api/auth/userinfo"
        case .authRefreshToken: return "/api/auth/refresh-token"
        case .aiAnalyze: return "/api/ai/analyze"
        case .aiAnalyzeScreenshot: return "/api/ai/analyze/screenshot"
        case .queryPhone: return "/api/query/phone"
        case .queryURL: return "/api/query/url"
        case .queryCompany: return "/api/query/company"
        case .queryHistory: return "/api/queries"
        case .deleteQuery(let id): return "/api/queries/\(id)"
        case .deleteQueryConversation(let conversationId): return "/api/queries/conversation/\(conversationId)"
        case .queryTags: return "/api/query/tags"
        case .reportSubmit: return "/api/report"
        // 切到 V2：列表精简（去 contentBlocks，加 hasContentBlocks/firstImage），详情走 ETag/304 协商缓存
        // V1 路由 /api/knowledge 仍由服务端 KnowledgeController 服务，老客户端不受影响
        case .knowledgeList: return "/api/v2/knowledge"
        case .knowledgeCategories: return "/api/knowledge/categories"
        case .knowledgeDetail(let id): return "/api/v2/knowledge/\(id)"
        case .subscriptionVerify: return "/api/subscription/verify"
        case .subscriptionStatus: return "/api/subscription/status"
        case .membershipPlans: return "/api/membership/plans"
        case .uploadAvatar: return "/api/upload/avatar"
        case .uploadFile: return "/api/upload/file"
        case .updateProfile: return "/api/user/profile"
        case .messagesList: return "/api/messages"
        case .messageUnreadCount: return "/api/messages/unread-count"
        case .messageMarkRead(let id): return "/api/messages/\(id)/read"
        case .feedbackSubmit: return "/api/feedback"
        case .publicConfig: return "/api/config"
        // ====== V3 ======
        case .v3UserHeartbeat: return "/api/user/v3/heartbeat"
        case .v3UserElderMode: return "/api/user/v3/elder-mode"
        case .v3UserRegisterDevice: return "/api/user/v3/devices"
        case .v3FamilyCreateGroup: return "/api/v3/family/groups"
        case .v3FamilyGetMyGroup: return "/api/v3/family/groups/me"
        case .v3FamilyGetMyGroups: return "/api/v3/family/groups/me/all"
        case .v3FamilyGenerateInvite(let groupId): return "/api/v3/family/groups/\(groupId)/invites"
        case .v3FamilyRedeemInvite: return "/api/v3/family/invites/redeem"
        case .v3FamilyLeaveGroup(let groupId): return "/api/v3/family/groups/\(groupId)/leave"
        case .v3FamilyDissolveGroup(let groupId): return "/api/v3/family/groups/\(groupId)"
        case .v3FamilyRemoveMember(let groupId, let userId): return "/api/v3/family/groups/\(groupId)/members/\(userId)"
        case .v3FamilyUpdatePreferences: return "/api/v3/family/members/me/preferences"
        case .v3FamilyCreateBroadcast: return "/api/v3/family/broadcast"
        case .v3FamilyGetBroadcasts: return "/api/v3/family/broadcasts"
        case .v3FamilyGetMembersStatus: return "/api/v3/family/members/status"
        case .v3FamilyMemberElderMode(let userId): return "/api/v3/family/members/\(userId)/elder-mode"
        case .v3FamilySetMyDisplayName(let groupId): return "/api/v3/family/groups/\(groupId)/members/me/display-name"
        case .v3FamilySetAlias(let memberId): return "/api/v3/family/members/\(memberId)/alias"
        // V3-B 情报
        case .v3IntelFeed: return "/api/v3/intel/feed"
        case .v3IntelDetail(let id): return "/api/v3/intel/\(id)"
        case .v3IntelCategories: return "/api/v3/intel/categories"
        case .v3IntelUnreadCount: return "/api/v3/intel/unread-count"
        case .v3IntelSubmit: return "/api/v3/intel/submit"
        case .v3IntelMySubmissions: return "/api/v3/intel/me/submissions"
        case .v3IntelGetPreferences: return "/api/v3/intel/preferences"
        case .v3IntelPutPreferences: return "/api/v3/intel/preferences"
        // V3-A1
        case .v3DeepfakeCreate: return "/api/v3/deepfake/voice"
        case .v3DeepfakeResult(let id): return "/api/v3/deepfake/voice/\(id)"
        case .v3DeepfakeHistory: return "/api/v3/deepfake/voice/history/me"
        case .v3DeepfakeDelete(let id): return "/api/v3/deepfake/voice/\(id)"
        case .v3DeepfakeFeedback(let id): return "/api/v3/deepfake/voice/\(id)/feedback"
        case .v3DeepfakeBroadcast(let id): return "/api/v3/deepfake/voice/\(id)/broadcast"
        case .v3DeepfakeStream(let id): return "/api/v3/deepfake/voice/\(id)/stream"
        // V3-F
        case .v3BreachAddTarget: return "/api/v3/breach/targets"
        case .v3BreachListTargets: return "/api/v3/breach/targets"
        case .v3BreachDeleteTarget(let id): return "/api/v3/breach/targets/\(id)"
        case .v3BreachListAlerts: return "/api/v3/breach/alerts"
        case .v3BreachDismissAlert(let id): return "/api/v3/breach/alerts/\(id)/dismiss"
        }
    }

    public var method: HTTPMethod {
        switch self {
        case .health, .authUserInfo, .authExportData, .authRegionHint, .queryHistory, .queryTags, .knowledgeList, .knowledgeCategories, .knowledgeDetail, .subscriptionStatus, .membershipPlans, .messagesList, .messageUnreadCount, .publicConfig,
             .v3FamilyGetMyGroup, .v3FamilyGetMyGroups, .v3FamilyGetBroadcasts, .v3FamilyGetMembersStatus,
             .v3IntelFeed, .v3IntelDetail, .v3IntelCategories, .v3IntelUnreadCount,
             .v3IntelMySubmissions, .v3IntelGetPreferences,
             .v3DeepfakeResult, .v3DeepfakeHistory, .v3DeepfakeStream,
             .v3BreachListTargets, .v3BreachListAlerts:
            return .GET
        case .authLogin, .authAppleLogin, .authSendCode, .authLogout, .authDeleteAccount, .authRefreshToken, .aiAnalyze, .aiAnalyzeScreenshot,
             .queryPhone, .queryURL, .queryCompany, .reportSubmit, .subscriptionVerify, .messageMarkRead, .feedbackSubmit,
             .v3UserHeartbeat, .v3UserRegisterDevice,
             .v3FamilyCreateGroup, .v3FamilyGenerateInvite, .v3FamilyRedeemInvite,
             .v3FamilyLeaveGroup, .v3FamilyCreateBroadcast,
             .v3IntelSubmit,
             .v3DeepfakeCreate, .v3DeepfakeFeedback, .v3DeepfakeBroadcast,
             .v3BreachAddTarget:
            return .POST
        case .deleteQuery, .deleteQueryConversation,
             .v3FamilyDissolveGroup, .v3FamilyRemoveMember,
             .v3DeepfakeDelete, .v3BreachDeleteTarget:
            return .DELETE
        case .uploadAvatar, .uploadFile:
            return .POST
        case .updateProfile, .v3UserElderMode, .v3FamilyUpdatePreferences, .v3FamilyMemberElderMode,
             .v3FamilySetMyDisplayName, .v3FamilySetAlias,
             .v3IntelPutPreferences,
             .v3BreachDismissAlert:
            return .PUT
        }
    }

    /// 是否需要携带 Authorization（有 token 就带，无 token 不报错）
    public var requiresAuth: Bool {
        switch self {
        case .authLogout, .authDeleteAccount, .authExportData, .authUserInfo, .subscriptionVerify, .subscriptionStatus, .uploadAvatar, .uploadFile, .updateProfile, .deleteQuery, .deleteQueryConversation, .queryHistory, .messagesList, .messageUnreadCount, .messageMarkRead, .feedbackSubmit,
             .v3UserHeartbeat, .v3UserElderMode, .v3UserRegisterDevice,
             .v3FamilyCreateGroup, .v3FamilyGetMyGroup, .v3FamilyGetMyGroups, .v3FamilyGenerateInvite, .v3FamilyRedeemInvite,
             .v3FamilyLeaveGroup, .v3FamilyDissolveGroup, .v3FamilyRemoveMember, .v3FamilyUpdatePreferences,
             .v3FamilyCreateBroadcast, .v3FamilyGetBroadcasts, .v3FamilyGetMembersStatus, .v3FamilyMemberElderMode,
             .v3FamilySetMyDisplayName, .v3FamilySetAlias,
             .v3IntelFeed, .v3IntelDetail, .v3IntelUnreadCount, .v3IntelSubmit,
             .v3IntelMySubmissions, .v3IntelGetPreferences, .v3IntelPutPreferences,
             .v3DeepfakeCreate, .v3DeepfakeResult, .v3DeepfakeHistory, .v3DeepfakeDelete, .v3DeepfakeFeedback, .v3DeepfakeBroadcast, .v3DeepfakeStream,
             .v3BreachAddTarget, .v3BreachListTargets, .v3BreachDeleteTarget,
             .v3BreachListAlerts, .v3BreachDismissAlert:
            return true
        default:
            return false
        }
    }

    public var queryItems: [URLQueryItem]? {
        switch self {
        case .queryHistory(let page, let pageSize, let riskLevel, let conversationId):
            var items = [
                URLQueryItem(name: "page", value: "\(page)"),
                URLQueryItem(name: "pageSize", value: "\(pageSize)")
            ]
            if let level = riskLevel, !level.isEmpty { items.append(URLQueryItem(name: "riskLevel", value: level)) }
            if let cid = conversationId, !cid.isEmpty { items.append(URLQueryItem(name: "conversation_id", value: cid)) }
            return items
        case .knowledgeList(let category, let page, let pageSize, let search, let language):
            var items = [
                URLQueryItem(name: "page", value: "\(page)"),
                URLQueryItem(name: "pageSize", value: "\(pageSize)")
            ]
            if let c = category, !c.isEmpty { items.append(URLQueryItem(name: "category", value: c)) }
            if let s = search, !s.isEmpty { items.append(URLQueryItem(name: "search", value: s)) }
            if let l = language, !l.isEmpty { items.append(URLQueryItem(name: "language", value: l)) }
            return items
        case .knowledgeCategories(let language):
            return [URLQueryItem(name: "language", value: language)]
        case .messagesList(let page, let pageSize):
            return [
                URLQueryItem(name: "page", value: "\(page)"),
                URLQueryItem(name: "pageSize", value: "\(pageSize)")
            ]
        case .v3FamilyGetBroadcasts(let limit):
            return [URLQueryItem(name: "limit", value: "\(limit)")]
        case .v3IntelFeed(let limit, let lang):
            var items = [URLQueryItem(name: "limit", value: "\(limit)")]
            if let l = lang, !l.isEmpty { items.append(URLQueryItem(name: "language", value: l)) }
            return items
        case .v3IntelCategories(let lang):
            if let l = lang, !l.isEmpty { return [URLQueryItem(name: "language", value: l)] }
            return nil
        case .v3DeepfakeHistory(let limit):
            return [URLQueryItem(name: "limit", value: "\(limit)")]
        default:
            return nil
        }
    }
}
