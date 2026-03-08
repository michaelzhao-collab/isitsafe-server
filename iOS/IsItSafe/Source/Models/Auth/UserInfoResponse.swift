//
//  UserInfoResponse.swift
//  IsItSafe
//
//  与 Server / Admin 用户资料字段一致：avatar, nickname, gender, birthday
//

import Foundation

public struct UserInfoResponse: Codable {
    public let id: String
    public let phone: String?
    public let email: String?
    public let country: String?

    public let avatar: String?
    public let nickname: String?
    public let gender: String?
    public let birthday: String?

    public let role: String
    public let lastLogin: String?
    public let createdAt: String?
    public let subscriptionStatus: String?
    public let subscriptionExpire: String?

    enum CodingKeys: String, CodingKey {
        case id, phone, email, country, role, avatar, nickname, gender, birthday, createdAt
        case lastLogin = "last_login"
        case subscriptionStatus = "subscriptionStatus"
        case subscriptionExpire = "subscriptionExpire"
    }
}
