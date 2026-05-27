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
    /// 微信登录时的昵称，优先于 nickname 展示
    public let wechatNickname: String?
    public let gender: String?
    public let birthday: String?

    public let role: String
    public let lastLogin: String?
    public let createdAt: String?
    public let subscriptionStatus: String?
    public let subscriptionExpire: String?

    // V3 新增字段（向后兼容；老版本服务端不返这些字段时为 nil，业务侧按 false/personal 处理）
    /// 长辈模式开关（V3-J）
    public let elderModeEnabled: Bool?
    /// 用户偏好语言（zh | en），nil 时回退 isitsafe.language UserDefaults
    public let language: String?
    /// ISO 3166-2 地区码（用于 F 模块海外可见性 + B 情报本地化）
    public let regionCode: String?

    enum CodingKeys: String, CodingKey {
        case id, phone, email, country, role, avatar, nickname, wechatNickname, gender, birthday, createdAt
        case lastLogin = "last_login"
        case subscriptionStatus = "subscriptionStatus"
        case subscriptionExpire = "subscriptionExpire"
        case elderModeEnabled = "elder_mode_enabled"
        case language
        case regionCode = "region_code"
    }
}
