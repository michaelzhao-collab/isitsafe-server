//
//  EmailAuthModels.swift
//  IsItSafe
//
//  邮箱 + 验证码登录的请求/响应模型（与手机号+密码登录并列，不替换）。
//

import Foundation

/// POST /api/auth/email/send-code 的请求体
public struct SendEmailCodeRequest: Encodable {
    public let email: String
    /// zh | en，服务端据此决定邮件正文语言
    public let language: String?

    public init(email: String, language: String? = nil) {
        self.email = email
        self.language = language
    }
}

/// POST /api/auth/email/send-code 的成功响应
/// 字段全部可选 + 带兜底默认值：服务端字段缺失时不至于解码失败卡住流程
public struct SendEmailCodeResponse: Decodable {
    public let success: Bool?
    public let cooldownSeconds: Int?
    public let expiresInSeconds: Int?

    public init(success: Bool? = nil, cooldownSeconds: Int? = nil, expiresInSeconds: Int? = nil) {
        self.success = success
        self.cooldownSeconds = cooldownSeconds
        self.expiresInSeconds = expiresInSeconds
    }

    /// 重新发送冷却秒数，缺省 60
    public var cooldown: Int { cooldownSeconds ?? 60 }
    /// 验证码有效期秒数，缺省 600（10 分钟）
    public var expiresIn: Int { expiresInSeconds ?? 600 }
}

/// 发送验证码被限频（HTTP 429）。
/// 单独定义是因为通用的 ResponseValidator 会把 429 压成 APIError.tooManyRequests，
/// 丢掉服务端给的 retryAfterSeconds 和具体文案，而倒计时需要这个秒数。
public struct EmailCodeRateLimited: Error {
    public let retryAfterSeconds: Int
    public let message: String?

    public init(retryAfterSeconds: Int, message: String?) {
        self.retryAfterSeconds = retryAfterSeconds
        self.message = message
    }
}
