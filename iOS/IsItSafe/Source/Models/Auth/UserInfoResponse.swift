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

    // 2026-10-06：NetworkManager 用 .convertFromSnakeCase，会先把 JSON 的 elder_mode_enabled 转成 elderModeEnabled
    // 再匹配 CodingKey；原来这里又显式写成 "elder_mode_enabled" → 永远对不上，长辈模式恒为 nil（=关），
    // 监护人远程开启也从未生效。CodingKey 必须写驼峰。本地缓存用默认编解码器，同一套 key 前后一致。
    enum CodingKeys: String, CodingKey {
        case id, phone, email, country, role, avatar, nickname, wechatNickname, gender, birthday, createdAt
        case lastLogin
        case subscriptionStatus
        case subscriptionExpire
        case elderModeEnabled
        case language
        case regionCode
    }
}
