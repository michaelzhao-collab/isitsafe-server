//
//  LoginResponse.swift
//  IsItSafe
//

import Foundation

public struct LoginResponse: Codable {
    public let accessToken: String
    public let refreshToken: String
    public let expiresIn: Int
}
