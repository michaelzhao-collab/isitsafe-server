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
    case riskDatabaseQueryFailed
    case knowledgeQueryFailed
    case serverError(statusCode: Int, message: String?)
    case unknown(String?)

    public var errorDescription: String? {
        switch self {
        case .invalidURL: return "请求地址无效"
        case .networkError(let e): return e?.localizedDescription ?? "网络异常"
        case .timeout: return "请求超时"
        case .decodingError: return "数据解析失败"
        case .unauthorized: return "登录已失效，请重新登录"
        case .forbidden: return "暂无权限访问"
        case .notFound: return "内容不存在或已下架"
        case .tooManyRequests: return "请求过于频繁，请稍后再试"
        case .aiAnalysisFailed: return "分析失败，请稍后重试"
        case .ocrFailed: return "图片识别失败，请重试或手动输入文字"
        case .subscriptionVerifyFailed: return "订阅验证失败，请稍后重试或联系客服"
        case .riskDatabaseQueryFailed: return "查询失败，请稍后重试"
        case .knowledgeQueryFailed: return "加载失败，请稍后重试"
        case .serverError(_, let msg): return msg ?? "服务暂时异常，请稍后重试"
        case .unknown(let msg): return msg ?? "发生未知错误，请稍后重试"
        }
    }

    /// iOS 直接展示给用户的文案
    public var userMessage: String { errorDescription ?? "发生未知错误，请稍后重试" }

    public var canRetry: Bool {
        switch self {
        case .networkError, .timeout, .serverError, .unknown,
             .aiAnalysisFailed, .riskDatabaseQueryFailed, .knowledgeQueryFailed:
            return true
        case .tooManyRequests: return true // 延迟后可重试
        case .unauthorized, .forbidden: return false
        case .invalidURL, .decodingError, .notFound, .ocrFailed, .subscriptionVerifyFailed:
            return true
        }
    }
}
