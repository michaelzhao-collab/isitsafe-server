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

    /// 解码时对未知/缺失的状态降级为 .unknown，避免整体解码失败
    public init(from decoder: Decoder) throws {
        let raw = (try? decoder.singleValueContainer().decode(String.self)) ?? ""
        self = FamilyActivityStatus(rawValue: raw) ?? .unknown
    }

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

    /// 未知角色降级为 .guardian（最小权限），避免解码失败
    public init(from decoder: Decoder) throws {
        let raw = (try? decoder.singleValueContainer().decode(String.self)) ?? ""
        self = FamilyMemberRole(rawValue: raw.lowercased()) ?? .guardian
    }
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
    /// V3-J SOS 拨号需要真号码（仅家庭组内成员可见，服务端权限校验）
    public let phone: String?
    /// 脱敏号码，用于 UI 展示（如 138****1234）
    public let phoneDisplay: String?

    /// 手写 init：对所有字段提供默认值，单个字段类型不匹配不再导致整体加载失败
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.id = (try? c.decode(String.self, forKey: .id)) ?? ""
        self.userId = (try? c.decode(String.self, forKey: .userId)) ?? ""
        self.role = (try? c.decode(FamilyMemberRole.self, forKey: .role)) ?? .guardian
        self.nickname = try? c.decodeIfPresent(String.self, forKey: .nickname)
        self.avatar = try? c.decodeIfPresent(String.self, forKey: .avatar)
        self.elderModeEnabled = (try? c.decode(Bool.self, forKey: .elderModeEnabled)) ?? false
        self.activityStatus = (try? c.decode(FamilyActivityStatus.self, forKey: .activityStatus)) ?? .unknown
        self.joinedAt = (try? c.decodeIfPresent(String.self, forKey: .joinedAt))
            ?? (try? c.decodeIfPresent(Date.self, forKey: .joinedAt))
                .map { ISO8601DateFormatter().string(from: $0) }
        self.phone = try? c.decodeIfPresent(String.self, forKey: .phone)
        self.phoneDisplay = try? c.decodeIfPresent(String.self, forKey: .phoneDisplay)
    }

    /// 构造器（用于本地占位和测试）
    public init(
        id: String,
        userId: String,
        role: FamilyMemberRole,
        nickname: String? = nil,
        avatar: String? = nil,
        elderModeEnabled: Bool = false,
        activityStatus: FamilyActivityStatus = .unknown,
        joinedAt: String? = nil,
        phone: String? = nil,
        phoneDisplay: String? = nil
    ) {
        self.id = id
        self.userId = userId
        self.role = role
        self.nickname = nickname
        self.avatar = avatar
        self.elderModeEnabled = elderModeEnabled
        self.activityStatus = activityStatus
        self.joinedAt = joinedAt
        self.phone = phone
        self.phoneDisplay = phoneDisplay
    }
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

    /// 手写 init：单字段类型不匹配不导致整体加载失败
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.id = (try? c.decode(String.self, forKey: .id)) ?? ""
        self.name = try? c.decodeIfPresent(String.self, forKey: .name)
        self.ownerUserId = (try? c.decode(String.self, forKey: .ownerUserId)) ?? ""
        self.memberCount = (try? c.decode(Int.self, forKey: .memberCount)) ?? 0
        self.maxMembers = (try? c.decode(Int.self, forKey: .maxMembers)) ?? 5
        self.isOwner = (try? c.decode(Bool.self, forKey: .isOwner)) ?? false
        self.createdAt = (try? c.decodeIfPresent(String.self, forKey: .createdAt))
            ?? (try? c.decodeIfPresent(Date.self, forKey: .createdAt))
                .map { ISO8601DateFormatter().string(from: $0) }
        self.members = (try? c.decode([FamilyMember].self, forKey: .members)) ?? []
    }

    /// 构造器（用于本地占位和测试）
    public init(
        id: String,
        name: String?,
        ownerUserId: String,
        memberCount: Int,
        maxMembers: Int,
        isOwner: Bool,
        createdAt: String?,
        members: [FamilyMember]
    ) {
        self.id = id
        self.name = name
        self.ownerUserId = ownerUserId
        self.memberCount = memberCount
        self.maxMembers = maxMembers
        self.isOwner = isOwner
        self.createdAt = createdAt
        self.members = members
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
/// S3-3：parentConsent 用于未成年人 COPPA 合规；非 minor 用户传 nil 即可
public struct RedeemInviteRequest: Codable {
    public let inviteCode: String
    public let parentConsent: Bool?
    public init(inviteCode: String, parentConsent: Bool? = nil) {
        self.inviteCode = inviteCode
        self.parentConsent = parentConsent
    }
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
