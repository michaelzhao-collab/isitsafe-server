//
//  SecureCacheStore.swift
//  IsItSafe
//
//  加密本地缓存：AES-GCM + 256bit 密钥（密钥首次启动时随机生成并存 Keychain）。
//  未来含敏感字段的缓存（截图 OCR 结果、用户问答原文等）可逐步迁移到此 store。
//
//  当前 ChatImageCache / LocalCacheStore 仍是明文，不强制迁移以避免引入兼容性问题；
//  新代码或敏感数据从今天起优先使用本 store。
//

import Foundation
import CryptoKit
import Security

public final class SecureCacheStore {
    public static let shared = SecureCacheStore()

    private let keychainAccount = "isitsafe.secure-cache.key"
    private let baseDir: URL

    private init() {
        let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first
            ?? URL(fileURLWithPath: NSTemporaryDirectory())
        baseDir = caches.appendingPathComponent("SecureCache", isDirectory: true)
        try? FileManager.default.createDirectory(at: baseDir, withIntermediateDirectories: true)
    }

    /// 加密写入；同名 key 直接覆盖
    public func write(_ data: Data, forKey key: String) throws {
        let symKey = try fetchOrCreateKey()
        let sealed = try AES.GCM.seal(data, using: symKey)
        guard let combined = sealed.combined else {
            throw NSError(domain: "SecureCacheStore", code: -1, userInfo: [NSLocalizedDescriptionKey: "Seal failed"])
        }
        let url = fileURL(forKey: key)
        try combined.write(to: url, options: [.atomic, .completeFileProtection])
    }

    /// 读取并解密；不存在或解密失败返回 nil
    public func read(forKey key: String) -> Data? {
        let url = fileURL(forKey: key)
        guard let combined = try? Data(contentsOf: url) else { return nil }
        guard let symKey = try? fetchOrCreateKey() else { return nil }
        guard let box = try? AES.GCM.SealedBox(combined: combined) else { return nil }
        return try? AES.GCM.open(box, using: symKey)
    }

    /// 删除
    public func delete(forKey key: String) {
        try? FileManager.default.removeItem(at: fileURL(forKey: key))
    }

    /// 清空整个加密缓存目录（卸载/登出时调用）
    public func purgeAll() {
        try? FileManager.default.removeItem(at: baseDir)
        try? FileManager.default.createDirectory(at: baseDir, withIntermediateDirectories: true)
    }

    // MARK: - Codable 便利方法
    public func write<T: Encodable>(_ value: T, forKey key: String) throws {
        let data = try JSONEncoder().encode(value)
        try write(data, forKey: key)
    }

    public func read<T: Decodable>(_ type: T.Type, forKey key: String) -> T? {
        guard let data = read(forKey: key) else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }

    // MARK: - 内部
    private func fileURL(forKey key: String) -> URL {
        // 文件名做哈希，避免 key 含 / : 等字符无法成为文件路径
        let hash = SHA256.hash(data: Data(key.utf8))
        let hex = hash.map { String(format: "%02x", $0) }.joined()
        return baseDir.appendingPathComponent(hex)
    }

    /// 从 Keychain 取 256bit 密钥；不存在则随机生成并写入
    private func fetchOrCreateKey() throws -> SymmetricKey {
        if let existing = readKeychainKey() {
            return SymmetricKey(data: existing)
        }
        var bytes = [UInt8](repeating: 0, count: 32)
        let status = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        guard status == errSecSuccess else {
            throw NSError(domain: "SecureCacheStore", code: Int(status), userInfo: [NSLocalizedDescriptionKey: "Random key gen failed"])
        }
        let data = Data(bytes)
        try writeKeychainKey(data)
        return SymmetricKey(data: data)
    }

    private func readKeychainKey() -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: keychainAccount,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess else { return nil }
        return result as? Data
    }

    private func writeKeychainKey(_ data: Data) throws {
        // 先删后写避免 duplicate item
        let deleteQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: keychainAccount
        ]
        SecItemDelete(deleteQuery as CFDictionary)

        let addQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: keychainAccount,
            kSecValueData as String: data,
            // 仅本设备解锁后可访问；不可同步到其他设备/iCloud
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]
        let status = SecItemAdd(addQuery as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw NSError(domain: "SecureCacheStore", code: Int(status), userInfo: [NSLocalizedDescriptionKey: "Keychain write failed"])
        }
    }
}
