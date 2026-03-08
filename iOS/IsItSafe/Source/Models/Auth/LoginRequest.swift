//
//  LoginRequest.swift
//  IsItSafe
//

import Foundation

public struct LoginRequest: Encodable {
    public let phone: String?
    public let email: String?
    public let code: String?
    public let smsCode: String?

    public init(phone: String? = nil, email: String? = nil, code: String? = nil, smsCode: String? = nil) {
        self.phone = phone
        self.email = email
        self.code = code
        self.smsCode = smsCode
    }
}
