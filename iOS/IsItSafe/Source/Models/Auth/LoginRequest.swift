//
//  LoginRequest.swift
//  IsItSafe
//

import Foundation

public struct LoginRequest: Encodable {
    public let phone: String?
    public let email: String?
    public let password: String?

    public init(phone: String? = nil, email: String? = nil, password: String? = nil) {
        self.phone = phone
        self.email = email
        self.password = password
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
