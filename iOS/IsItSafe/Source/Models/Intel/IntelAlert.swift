//
//  IntelAlert.swift
//  IsItSafe
//
//  V3-B 情报模型（feed / detail / submission / preferences）
//

import Foundation

public enum IntelSeverity: String, Codable {
    case normal, high, urgent

    public var displayName: String {
        switch self {
        case .urgent: return "紧急"
        case .high: return "高风险"
        case .normal: return "提示"
        }
    }
}

public struct IntelAlertSummary: Codable, Identifiable, Hashable {
    public let id: String
    public let title: String
    public let summary: String
    public let category: String
    public let severity: IntelSeverity
    public let language: String?
    public let sourceUrl: String?
    public let publishedAt: String?
    public let isRead: Bool

    public func hash(into hasher: inout Hasher) { hasher.combine(id) }
    public static func == (l: IntelAlertSummary, r: IntelAlertSummary) -> Bool { l.id == r.id }
}

public struct IntelAlertDetail: Codable, Identifiable {
    public let id: String
    public let title: String
    public let summary: String
    public let contentBlocks: JSONValue?
    public let category: String
    public let severity: IntelSeverity
    public let targetRegions: [String]?
    public let targetAudiences: [String]?
    public let language: String?
    public let sourceUrl: String?
    public let status: String
    public let publishedAt: String?
}

public struct IntelCategory: Codable, Identifiable {
    public let key: String
    public let name: String
    public var id: String { key }
}

public struct IntelSubmitRequest: Codable {
    public let category: String?
    public let content: String
    public let attachments: [String]?
}

public struct IntelSubmissionResponse: Codable {
    public let id: String
    public let status: String
}

public struct IntelPreferences: Codable {
    public let userId: String
    public let categories: [String]
    public let pushFreq: String   // daily_1 | daily_3 | weekly | off
    public let pushTime: String?
    public let updatedAt: String?
}

public struct IntelPreferencesUpdateRequest: Codable {
    public let categories: [String]?
    public let pushFreq: String?
    public let pushTime: String?
}

public struct IntelUnreadCountResponse: Codable {
    public let count: Int
}
