//
//  LoginRequest.swift
//  IsItSafe
//

import Foundation

public struct LoginRequest: Encodable {
    public let phone: String?
    public let email: String?
    public let password: String?
    /// 邮箱验证码登录用（手机号+密码登录时为 nil）。
    /// 可选字段在合成的 Encodable 里走 encodeIfPresent，nil 不会出现在 body 里，
    /// 所以手机号登录的请求体与改动前完全一致。
    public let code: String?

    public init(phone: String? = nil, email: String? = nil, password: String? = nil, code: String? = nil) {
        self.phone = phone
        self.email = email
        self.password = password
        self.code = code
    }
}

public struct AppleLoginRequest: Encodable {
    public let identityToken: String
    public let appleUser: String?
    public let nonce: String?
    public let displayName: String?

    public init(identityToken: String, appleUser: String? = nil, nonce: String? = nil, displayName: String? = nil) {
        self.identityToken = identityToken
        self.appleUser = appleUser
        self.nonce = nonce
        self.displayName = displayName
    }
}
