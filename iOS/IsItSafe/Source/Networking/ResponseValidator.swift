//
//  ResponseValidator.swift
//  IsItSafe
//
//  统一校验 HTTP 状态码、解析业务错误 JSON、抛出 APIError。
//

import Foundation

public final class ResponseValidator {
    public static func validate(data: Data?, response: URLResponse?) throws {
        guard let http = response as? HTTPURLResponse else {
            throw APIError.unknown("无效响应")
        }
        switch http.statusCode {
        case 200...299:
            return
        case 401:
            TokenStore.shared.clearToken()
            UserSessionStore.shared.clearSession()
            throw APIError.unauthorized
        case 403:
            throw APIError.forbidden
        case 404:
            throw APIError.notFound
        case 429:
            throw APIError.tooManyRequests
        case 400...499:
            let msg = parseMessage(from: data)
            if let code = parseBusinessCode(from: data) {
                switch code {
                case 10001: throw APIError.aiAnalysisFailed
                case 10002: throw APIError.ocrFailed
                case 10003: throw APIError.subscriptionVerifyFailed
                case 10004: throw APIError.riskDatabaseQueryFailed
                case 10005: throw APIError.knowledgeQueryFailed
                default: throw APIError.serverError(statusCode: http.statusCode, message: msg)
                }
            }
            throw APIError.serverError(statusCode: http.statusCode, message: msg)
        case 500...599:
            let msg = parseMessage(from: data)
            throw APIError.serverError(statusCode: http.statusCode, message: msg)
        default:
            let msg = parseMessage(from: data)
            throw APIError.serverError(statusCode: http.statusCode, message: msg)
        }
    }

    private static func parseMessage(from data: Data?) -> String? {
        guard let data = data,
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        if let m = json["message"] as? String { return m }
        if let m = json["message"] as? [String] { return m.first }
        return nil
    }

    private static func parseBusinessCode(from data: Data?) -> Int? {
        guard let data = data,
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let code = json["code"] as? Int else { return nil }
        return code
    }
}
