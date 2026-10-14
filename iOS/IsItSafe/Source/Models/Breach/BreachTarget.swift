//
//  BreachTarget.swift
//  IsItSafe
//
//  V3-F 数据泄露监控模型（仅海外；原名「暗网监控」，2026-10-14 改名并补邮箱验证）
//

import Foundation

public enum BreachSeverity: String, Codable {
    case low, medium, high

    public var displayName: String {
        switch self {
        case .high: return L10n.tr(zh: "高", en: "HIGH")
        case .medium: return L10n.tr(zh: "中", en: "MED")
        case .low: return L10n.tr(zh: "低", en: "LOW")
        }
    }
}

public struct BreachTargetItem: Codable, Identifiable {
    public let id: String
    public let type: String           // 'email'
    public let displayValue: String   // 脱敏邮箱（service 返回）
    public let verified: Bool
    public let lastScannedAt: String?
    public let alertCount: Int
    public let createdAt: String?
    /// ok / failed / pending_verification / never（老服务端不下发 → nil，按 verified + lastScannedAt 推断）
    public let scanStatus: String?
    public let scanFailReason: String?
    public let verificationExpiresAt: String?

    public var effectiveScanStatus: String {
        if let s = scanStatus { return s }
        if !verified { return "pending_verification" }
        return lastScannedAt == nil ? "never" : "ok"
    }
}

public struct BreachAlert: Codable, Identifiable {
    public let id: String
    public let targetId: String
    public let breachSource: String
    public let breachName: String
    public let breachDate: String?
    public let exposedData: [String]
    public let severity: BreachSeverity
    public let dismissed: Bool
    public let createdAt: String?
}

public struct BreachAddTargetRequest: Codable {
    public let email: String
}

public struct BreachAddTargetResponse: Codable {
    public let id: String
    public let displayValue: String
    public let verified: Bool
    public let needsEmailVerification: Bool?
    public let codeExpiresInSeconds: Int?
    public let resendCooldownSeconds: Int?
    public let scanStatus: String?
}

public struct BreachVerifyRequest: Codable {
    public let code: String
}

public struct BreachVerifyResponse: Codable {
    public let success: Bool
    public let scanStatus: String?
}

public struct BreachResendResponse: Codable {
    public let success: Bool
    public let resendCooldownSeconds: Int?
}
