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

// MARK: - 默认显示名（2026-10-15）

public extension UserInfoResponse {
    /// 与服务端 member-name.util.ts / FamilyMember.effectiveName 同一套规则，
    /// 「我的」页、会员中心、家人那边看到的名字一致。
    /// 原来取邮箱末 4 位，Apple 登录用户显示成「User .com」。
    /// 顺序：昵称 → 微信昵称 → 手机尾号 4 位 → 邮箱 @ 前缀（Apple 隐藏邮箱除外）→ 用户 + id 后 4 位
    func defaultDisplayName(isEnglish: Bool) -> String {
        func pick(_ v: String?) -> String? {
            let t = (v ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            return t.isEmpty ? nil : t
        }
        if let n = pick(nickname) { return n }
        if let n = pick(wechatNickname) { return n }
        let digits = (phone ?? "").filter { ("0"..."9").contains($0) }
        if digits.count >= 4 { return String(digits.suffix(4)) }
        let e = (email ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if e.contains("@"), !e.hasSuffix("@privaterelay.appleid.com"),
           let local = e.split(separator: "@", omittingEmptySubsequences: false).first, !local.isEmpty {
            return String(local.prefix(12))
        }
        let tail = String(id.suffix(4)).uppercased()
        return isEnglish ? "User \(tail)" : "用户\(tail)"
    }
}
