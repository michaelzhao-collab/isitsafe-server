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
