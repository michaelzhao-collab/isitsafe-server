//
//  BreachTarget.swift
//  IsItSafe
//
//  V3-F 暗网监控模型（仅海外）
//

import Foundation

public enum BreachSeverity: String, Codable {
    case low, medium, high

    public var displayName: String {
        switch self {
        case .high: return "HIGH"
        case .medium: return "MED"
        case .low: return "LOW"
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
}
