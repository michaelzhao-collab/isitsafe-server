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
        case .invalidURL: return "请求地址无效"
        case .networkError(let e):
            // 拆细 URLError 让用户能采取正确行动
            if let urlErr = e as? URLError {
                switch urlErr.code {
                case .notConnectedToInternet:
                    return "无网络连接，请检查 Wi-Fi 或蜂窝数据是否已开启"
                case .networkConnectionLost:
                    return "网络连接已中断，请稍后再试"
                case .dnsLookupFailed:
                    return "无法解析服务器地址，请检查网络环境"
                case .cannotConnectToHost, .cannotFindHost:
                    return "暂时无法连接到服务器，请稍后再试"
                case .secureConnectionFailed, .serverCertificateUntrusted,
                     .clientCertificateRejected, .clientCertificateRequired:
                    return "安全连接失败，请稍后再试或升级到最新版"
                default: break
                }
            }
            return e?.localizedDescription ?? "网络异常，请检查连接后重试"
        case .timeout: return "请求超时，请检查网络后重试"
        case .decodingError: return "数据格式异常，请稍后重试（已记录）"
        case .unauthorized: return "登录已过期，请重新登录"
        case .forbidden: return "暂无权限访问该功能"
        case .notFound: return "内容不存在或已下架"
        case .tooManyRequests: return "请求过于频繁，请稍后再试"
        case .aiAnalysisFailed: return "分析失败，请稍后重试"
        case .ocrFailed: return "图片识别失败，请重试或手动输入文字"
        case .subscriptionVerifyFailed: return "订阅验证失败，请稍后重试或联系客服"
        case .purchaseCancelledByUser: return nil
        case .riskDatabaseQueryFailed: return "风险库查询失败，请稍后重试"
        case .knowledgeQueryFailed: return "案例加载失败，请稍后重试"
        case .serverError(let code, let msg):
            if let m = msg, !m.isEmpty { return m }
            if code >= 500 { return "服务器繁忙，请稍后再试（\(code)）" }
            return "请求失败（\(code)），请稍后再试"
        case .unknown(let msg): return msg ?? "出错了，请稍后再试"
        }
    }

    /// iOS 直接展示给用户的文案
    public var userMessage: String { errorDescription ?? "出错了，请稍后再试" }

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
