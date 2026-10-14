//
//  APIError.swift
//  IsItSafe
//
//  统一 API 错误，所有接口错误收敛到此；便于映射为用户提示文案。
//

import Foundation

public enum APIError: Error, LocalizedError {
    case invalidURL
    case networkError(Error?)
    case timeout
    case decodingError(Error?)
    case unauthorized
    case forbidden
    case notFound
    case tooManyRequests
    case aiAnalysisFailed
    case ocrFailed
    case subscriptionVerifyFailed
    case purchaseCancelledByUser
    case riskDatabaseQueryFailed
    case knowledgeQueryFailed
    case serverError(statusCode: Int, message: String?)
    case unknown(String?)

    public var errorDescription: String? {
        switch self {
        case .invalidURL: return L10n.tr(zh: "请求地址无效", en: "Invalid request URL")
        case .networkError(let e):
            // 拆细 URLError 让用户能采取正确行动
            if let urlErr = e as? URLError {
                switch urlErr.code {
                case .notConnectedToInternet:
                    return L10n.tr(zh: "无网络连接，请检查 Wi-Fi 或蜂窝数据是否已开启", en: "No internet connection. Please check Wi-Fi or cellular data.")
                case .networkConnectionLost:
                    return L10n.tr(zh: "网络连接已中断，请稍后再试", en: "The network connection was lost. Please try again later.")
                case .dnsLookupFailed:
                    return L10n.tr(zh: "无法解析服务器地址，请检查网络环境", en: "Can't resolve the server address. Please check your network.")
                case .cannotConnectToHost, .cannotFindHost:
                    return L10n.tr(zh: "暂时无法连接到服务器，请稍后再试", en: "Can't connect to the server right now. Please try again later.")
                case .secureConnectionFailed, .serverCertificateUntrusted,
                     .clientCertificateRejected, .clientCertificateRequired:
                    return L10n.tr(zh: "安全连接失败，请稍后再试或升级到最新版", en: "Secure connection failed. Please try again later or update to the latest version.")
                default: break
                }
            }
            return e?.localizedDescription ?? L10n.tr(zh: "网络异常，请检查连接后重试", en: "Network error. Please check your connection and try again.")
        case .timeout: return L10n.tr(zh: "请求超时，请检查网络后重试", en: "Request timed out. Please check your network and try again.")
        case .decodingError: return L10n.tr(zh: "数据格式异常，请稍后重试（已记录）", en: "Unexpected data format. Please try again later (logged).")
        case .unauthorized: return L10n.tr(zh: "登录已过期，请重新登录", en: "Your session has expired. Please sign in again.")
        case .forbidden: return L10n.tr(zh: "暂无权限访问该功能", en: "You don't have permission to use this feature.")
        case .notFound: return L10n.tr(zh: "内容不存在或已下架", en: "This content doesn't exist or has been removed.")
        case .tooManyRequests: return L10n.tr(zh: "请求过于频繁，请稍后再试", en: "Too many requests. Please try again later.")
        case .aiAnalysisFailed: return L10n.tr(zh: "分析失败，请稍后重试", en: "Analysis failed. Please try again later.")
        case .ocrFailed: return L10n.tr(zh: "图片识别失败，请重试或手动输入文字", en: "Couldn't read the image. Please retry or type the text manually.")
        case .subscriptionVerifyFailed: return L10n.tr(zh: "订阅验证失败，请稍后重试或联系客服", en: "Subscription verification failed. Please try again later or contact support.")
        case .purchaseCancelledByUser: return nil
        case .riskDatabaseQueryFailed: return L10n.tr(zh: "风险库查询失败，请稍后重试", en: "Risk database lookup failed. Please try again later.")
        case .knowledgeQueryFailed: return L10n.tr(zh: "案例加载失败，请稍后重试", en: "Failed to load cases. Please try again later.")
        case .serverError(let code, let msg):
            if let m = msg, !m.isEmpty { return m }
            if code >= 500 { return L10n.tr(zh: "服务器繁忙，请稍后再试（\(code)）", en: "Server is busy. Please try again later (\(code)).") }
            return L10n.tr(zh: "请求失败（\(code)），请稍后再试", en: "Request failed (\(code)). Please try again later.")
        case .unknown(let msg): return msg ?? L10n.tr(zh: "出错了，请稍后再试", en: "Something went wrong. Please try again later.")
        }
    }

    /// iOS 直接展示给用户的文案
    public var userMessage: String { errorDescription ?? L10n.tr(zh: "出错了，请稍后再试", en: "Something went wrong. Please try again later.") }

    public var canRetry: Bool {
        switch self {
        case .networkError, .timeout, .serverError, .unknown,
             .aiAnalysisFailed, .riskDatabaseQueryFailed, .knowledgeQueryFailed:
            return true
        case .tooManyRequests: return true // 延迟后可重试
        case .unauthorized, .forbidden: return false
        case .purchaseCancelledByUser: return false
        case .invalidURL, .decodingError, .notFound, .ocrFailed, .subscriptionVerifyFailed:
            return true
        }
    }
}
