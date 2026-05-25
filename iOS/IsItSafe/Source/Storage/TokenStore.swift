//
//  TokenStore.swift
//  IsItSafe
//
//  使用 Keychain 保存 accessToken；401 时支持清除。
//

import Foundation
import Security

public final class TokenStore {
    public static let shared = TokenStore()
    private let accessTokenKey = "isitsafe.accessToken"
    private let refreshTokenKey = "isitsafe.refreshToken"

    private init() {}

    public var accessToken: String? {
        get { read(key: accessTokenKey) }
        set { if let v = newValue { save(key: accessTokenKey, value: v) } else { delete(key: accessTokenKey) } }
    }

    public var refreshToken: String? {
        get { read(key: refreshTokenKey) }
        set { if let v = newValue { save(key: refreshTokenKey, value: v) } else { delete(key: refreshTokenKey) } }
    }

    public func saveToken(access: String, refresh: String) {
        accessToken = access
        refreshToken = refresh
    }

    public func clearToken() {
        accessToken = nil
        refreshToken = nil
    }

    /// 解析当前 accessToken 的 JWT exp 字段，返回过期时刻；token 不合法/无 exp 时返回 nil。
    /// 用于 NetworkManager 在请求前主动判断是否需要刷新，避免被动等 401。
    public var accessTokenExpiry: Date? {
        guard let token = accessToken else { return nil }
        return Self.expiryDate(from: token)
    }

    /// JWT 不会很大，本地解析比走 keychain 多次读取更快；仅读 header.payload 不验签。
    private static func expiryDate(from jwt: String) -> Date? {
        let parts = jwt.split(separator: ".", omittingEmptySubsequences: false)
        guard parts.count >= 2 else { return nil }
        var payload = String(parts[1])
        // base64url → base64 + padding
        payload = payload
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        let mod = payload.count % 4
        if mod > 0 { payload += String(repeating: "=", count: 4 - mod) }
        guard let data = Data(base64Encoded: payload),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        if let exp = json["exp"] as? TimeInterval {
            return Date(timeIntervalSince1970: exp)
        }
        if let expInt = json["exp"] as? Int {
            return Date(timeIntervalSince1970: TimeInterval(expInt))
        }
        return nil
    }

    private func save(key: String, value: String) {
        guard let data = value.data(using: .utf8) else { return }
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecValueData as String: data
        ]
        SecItemDelete(query as CFDictionary)
        SecItemAdd(query as CFDictionary, nil)
    }

    private func read(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data,
              let str = String(data: data, encoding: .utf8) else { return nil }
        return str
    }

    private func delete(key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key
        ]
        SecItemDelete(query as CFDictionary)
    }
}
