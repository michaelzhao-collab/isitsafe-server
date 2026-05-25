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

    public var path: String {
        switch self {
        case .health: return "/api/health"
        case .authLogin: return "/api/auth/login"
        case .authAppleLogin: return "/api/auth/apple/login"
        case .authSendCode: return "/api/auth/send-sms-code"
        case .authRegionHint: return "/api/auth/region-hint"
        case .authLogout: return "/api/auth/logout"
        case .authDeleteAccount: return "/api/auth/delete-account"
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
        case .knowledgeList: return "/api/knowledge"
        case .knowledgeCategories: return "/api/knowledge/categories"
        case .knowledgeDetail(let id): return "/api/knowledge/\(id)"
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
        }
    }

    public var method: HTTPMethod {
        switch self {
        case .health, .authUserInfo, .authRegionHint, .queryHistory, .queryTags, .knowledgeList, .knowledgeCategories, .knowledgeDetail, .subscriptionStatus, .membershipPlans, .messagesList, .messageUnreadCount, .publicConfig:
            return .GET
        case .authLogin, .authAppleLogin, .authSendCode, .authLogout, .authDeleteAccount, .authRefreshToken, .aiAnalyze, .aiAnalyzeScreenshot,
             .queryPhone, .queryURL, .queryCompany, .reportSubmit, .subscriptionVerify, .messageMarkRead, .feedbackSubmit:
            return .POST
        case .deleteQuery, .deleteQueryConversation:
            return .DELETE
        case .uploadAvatar, .uploadFile:
            return .POST
        case .updateProfile:
            return .PUT
        }
    }

    /// 是否需要携带 Authorization（有 token 就带，无 token 不报错）
    public var requiresAuth: Bool {
        switch self {
        case .authLogout, .authDeleteAccount, .authUserInfo, .subscriptionVerify, .subscriptionStatus, .uploadAvatar, .uploadFile, .updateProfile, .deleteQuery, .deleteQueryConversation, .queryHistory, .messagesList, .messageUnreadCount, .messageMarkRead, .feedbackSubmit:
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
        default:
            return nil
        }
    }
}
