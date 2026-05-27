//
//  FamilyGroup.swift
//  IsItSafe
//
//  V3-E 家庭守护数据模型
//  字段与服务端 family-group.dto.ts 完全对齐
//

import Foundation

/// 家庭成员活跃状态
public enum FamilyActivityStatus: String, Codable {
    case activeToday = "active_today"      // 🟢 今日已活跃
    case inactive1day = "inactive_1day"     // 🟡 昨日未活跃
    case inactive2days = "inactive_2days"   // ⚠️ 已 2 天未活跃
    case inactive3plus = "inactive_3plus"   // 🚨 已 3 天+ 未活跃
    case unknown                            // 从未记录

    public var emoji: String {
        switch self {
        case .activeToday: return "🟢"
        case .inactive1day: return "🟡"
        case .inactive2days: return "⚠️"
        case .inactive3plus: return "🚨"
        case .unknown: return "⚪️"
        }
    }

    public var displayName: String {
        switch self {
        case .activeToday: return "今日已活跃"
        case .inactive1day: return "昨日未活跃"
        case .inactive2days: return "已 2 天未活跃"
        case .inactive3plus: return "已 3 天+ 未活跃"
        case .unknown: return "暂无记录"
        }
    }
}

/// 家庭成员角色
public enum FamilyMemberRole: String, Codable {
    case owner
    case guardian
    case ward
}

public struct FamilyMember: Codable, Identifiable {
    public let id: String
    public let userId: String
    public let role: FamilyMemberRole
    public let nickname: String?
    public let avatar: String?
    public let elderModeEnabled: Bool
    public let activityStatus: FamilyActivityStatus
    public let joinedAt: String?
}

public struct FamilyGroup: Codable, Identifiable {
    public let id: String
    public let name: String?
    public let ownerUserId: String
    public let memberCount: Int
    public let maxMembers: Int
    public let isOwner: Bool
    public let createdAt: String?
    public let members: [FamilyMember]

    public var displayName: String {
        name?.isEmpty == false ? name! : "我的家庭"
    }

    public var isFull: Bool {
        memberCount >= maxMembers
    }
}

/// 创建家庭组请求
public struct CreateFamilyGroupRequest: Codable {
    public let name: String?
    public init(name: String? = nil) { self.name = name }
}

/// 创建家庭组响应
public struct CreateFamilyGroupResponse: Codable {
    public let id: String
    public let name: String?
}

/// 兑换邀请码请求
public struct RedeemInviteRequest: Codable {
    public let inviteCode: String
    public init(inviteCode: String) { self.inviteCode = inviteCode }
}

/// 兑换邀请码响应
public struct RedeemInviteResponse: Codable {
    public let groupId: String
    public let joinedAt: String?
}

/// 生成邀请码响应
public struct GenerateInviteResponse: Codable {
    public let code: String
    public let expiresAt: String

    public var shareLink: String {
        "https://starlens.ai/i/\(code)"
    }
}

/// 更新隐私偏好请求
public struct UpdateFamilyPreferencesRequest: Codable {
    public let shareQueryResults: Bool?
    public init(shareQueryResults: Bool?) { self.shareQueryResults = shareQueryResults }
}

/// 家庭官方广播消息（不含触发者身份）
public struct FamilyBroadcast: Codable, Identifiable {
    public let id: String
    public let contentType: String        // phone | url | sms | voice
    public let contentDisplay: String
    public let resultLabel: ResultLabel   // scam | safe | unknown
    public let resultDetail: [String: AnyCodable]?
    public let source: String             // auto_query | manual_share
    public let createdAt: String?

    public enum ResultLabel: String, Codable {
        case scam, safe, unknown
    }
}

/// 主动分享请求
public struct BroadcastRequest: Codable {
    public let contentType: String   // phone | url | sms | voice
    public let content: String
    public init(contentType: String, content: String) {
        self.contentType = contentType
        self.content = content
    }
}

/// 主动分享响应
public struct BroadcastResponse: Codable {
    public let delivered: Bool
    public let broadcastId: String?
    public let resultLabel: FamilyBroadcast.ResultLabel
    public let quotaRemaining: Int
    public let skipReason: String?

    public var skipReasonEnum: SkipReason? {
        guard let r = skipReason else { return nil }
        return SkipReason(rawValue: r)
    }

    public enum SkipReason: String, Codable {
        case duplicate
        case quotaExceeded = "quota_exceeded"
        case noGroup = "no_group"
    }
}

/// 心跳响应
public struct HeartbeatResponse: Codable {
    public let active: Bool
    public let todayCount: Int

    enum CodingKeys: String, CodingKey {
        case active
        case todayCount = "today_count"
    }
}

/// 通用 JSON value，用于 resultDetail 这种动态结构
public struct AnyCodable: Codable {
    public let value: Any

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self.value = NSNull()
        } else if let b = try? container.decode(Bool.self) {
            self.value = b
        } else if let i = try? container.decode(Int.self) {
            self.value = i
        } else if let d = try? container.decode(Double.self) {
            self.value = d
        } else if let s = try? container.decode(String.self) {
            self.value = s
        } else if let arr = try? container.decode([AnyCodable].self) {
            self.value = arr.map(\.value)
        } else if let obj = try? container.decode([String: AnyCodable].self) {
            self.value = obj.mapValues(\.value)
        } else {
            self.value = NSNull()
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encodeNil()
    }
}
