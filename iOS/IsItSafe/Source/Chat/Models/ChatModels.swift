//
//  ChatModels.swift
//  IsItSafe
//
//  V5.1 自建 IM 家庭群聊数据模型。字段与后端 ChatService.MessageView 对齐。
//

import Foundation

/// 消息类型；与后端 MESSAGE_TYPES 对齐
public enum ChatMessageType: String, Codable {
    case text
    case voice
    case image
    case bigEmoji
    case card
    case system
    case unknown

    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = ChatMessageType(rawValue: raw) ?? .unknown
    }
}

/// 本地发送状态（仅客户端使用，不来自服务端）
public enum ChatSendState: String, Codable {
    case sending    // 已上屏、等待服务端确认
    case sent       // 已确认、拿到 seq
    case failed     // 发送失败，可点击重发
}

/// 一条群聊消息（服务端权威 + 本地态）
public struct ChatMessage: Codable, Identifiable, Equatable {
    public var id: String                 // 服务端消息 id；乐观消息用 clientMsgId 占位
    public var groupId: String
    public var seq: Int64                  // 服务端 seq；乐观消息未确认时为 0
    public var senderId: String?           // nil = 系统/官方
    public var type: ChatMessageType
    public var content: String?
    public var payload: ChatPayload?
    public var eventId: String?
    public var clientMsgId: String?
    public var status: String              // normal | recalled
    public var version: Int
    public var createdAt: Date

    // 本地态（不参与服务端编码）
    public var sendState: ChatSendState?

    enum CodingKeys: String, CodingKey {
        case id, groupId, seq, senderId, type, content, payload, eventId, clientMsgId, status, version, createdAt
    }

    public init(id: String, groupId: String, seq: Int64, senderId: String?, type: ChatMessageType,
                content: String?, payload: ChatPayload?, eventId: String?, clientMsgId: String?,
                status: String, version: Int, createdAt: Date, sendState: ChatSendState?) {
        self.id = id; self.groupId = groupId; self.seq = seq; self.senderId = senderId
        self.type = type; self.content = content; self.payload = payload; self.eventId = eventId
        self.clientMsgId = clientMsgId; self.status = status; self.version = version
        self.createdAt = createdAt; self.sendState = sendState
    }

    /// 自定义解码：createdAt 后端发 ISO8601 字符串，而共享 NetworkManager 的 decoder 未设
    /// dateDecodingStrategy（默认按数字解）。这里手动容错解析（ISO 字符串 / 秒 / 毫秒 epoch），
    /// 否则每次收发都解码失败，整条链路瘫痪。
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        groupId = try c.decode(String.self, forKey: .groupId)
        seq = try c.decodeIfPresent(Int64.self, forKey: .seq) ?? 0
        senderId = try c.decodeIfPresent(String.self, forKey: .senderId)
        type = try c.decode(ChatMessageType.self, forKey: .type)
        content = try c.decodeIfPresent(String.self, forKey: .content)
        payload = try c.decodeIfPresent(ChatPayload.self, forKey: .payload)
        eventId = try c.decodeIfPresent(String.self, forKey: .eventId)
        clientMsgId = try c.decodeIfPresent(String.self, forKey: .clientMsgId)
        status = try c.decodeIfPresent(String.self, forKey: .status) ?? "normal"
        version = try c.decodeIfPresent(Int.self, forKey: .version) ?? 1
        createdAt = Self.decodeFlexibleDate(c, key: .createdAt) ?? Date()
        sendState = nil
    }

    private static func decodeFlexibleDate(_ c: KeyedDecodingContainer<CodingKeys>, key: CodingKeys) -> Date? {
        if let s = try? c.decode(String.self, forKey: key) {
            let iso = ISO8601DateFormatter()
            iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let d = iso.date(from: s) { return d }
            iso.formatOptions = [.withInternetDateTime]
            if let d = iso.date(from: s) { return d }
        }
        if let n = try? c.decode(Double.self, forKey: key) {
            return Date(timeIntervalSince1970: n > 1e12 ? n / 1000 : n)
        }
        return nil
    }

    public var isRecalled: Bool { status == "recalled" }
    public var isSystem: Bool { senderId == nil }
    public var isConfirmed: Bool { seq > 0 }
}

/// 弱类型 payload：voice{url,duration,transcript} / image{url,w,h,thumb} / card 全量
/// 用 JSON 透传，具体渲染层各自取字段，避免为每种卡片建强类型（后端可演进）
public struct ChatPayload: Codable, Equatable {
    public var raw: [String: JSONValue]

    public init(_ raw: [String: JSONValue] = [:]) { self.raw = raw }

    public init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        raw = (try? c.decode([String: JSONValue].self)) ?? [:]
    }
    public func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        try c.encode(raw)
    }

    // 复用全局 JSONValue（定义于 ArticleBlock.swift），其 .string/.number 为计算属性
    public func string(_ key: String) -> String? { raw[key]?.string }
    public func int(_ key: String) -> Int? { raw[key]?.number.map { Int($0) } }
    public func double(_ key: String) -> Double? { raw[key]?.number }

    // 全局 JSONValue 未声明 Equatable，用稳定排序编码后比对（供 ChatMessage 的 Equatable 合成）
    public static func == (lhs: ChatPayload, rhs: ChatPayload) -> Bool {
        let enc = JSONEncoder()
        enc.outputFormatting = [.sortedKeys]
        return (try? enc.encode(lhs)) == (try? enc.encode(rhs))
    }
}

// MARK: - 请求 / 响应 DTO

/// 发送请求体
public struct ChatSendRequest: Encodable {
    public let clientMsgId: String
    public let type: String
    public let content: String?
    public let payload: [String: JSONValue]?
}

/// 拉取响应体
public struct ChatPullResponse: Decodable {
    public let messages: [ChatMessage]
    public let lastSeq: Int64
}

/// 已读游标请求
public struct ChatReadCursorRequest: Encodable {
    public let seq: Int64
}
public struct ChatReadCursorResponse: Decodable {
    public let lastReadSeq: Int64
}

/// 撤回请求
public struct ChatRecallRequest: Encodable {
    public let messageId: String
}

/// 未读汇总项
public struct ChatUnreadItem: Decodable, Identifiable {
    public let groupId: String
    public let lastSeq: Int64
    public let lastReadSeq: Int64
    public let unread: Int
    /// V5.1 群聊免打扰：客户端据此把未读数字渲染为小红点（老服务端无此字段 → 默认 false）
    public let muted: Bool
    public var id: String { groupId }

    enum CodingKeys: String, CodingKey { case groupId, lastSeq, lastReadSeq, unread, muted }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        groupId = try c.decode(String.self, forKey: .groupId)
        lastSeq = try c.decodeIfPresent(Int64.self, forKey: .lastSeq) ?? 0
        lastReadSeq = try c.decodeIfPresent(Int64.self, forKey: .lastReadSeq) ?? 0
        unread = try c.decodeIfPresent(Int.self, forKey: .unread) ?? 0
        muted = try c.decodeIfPresent(Bool.self, forKey: .muted) ?? false
    }
}

/// V5.1 §7-4 群成员已读游标项（GET /chat/groups/:groupId/read-states）
public struct ChatReadState: Decodable {
    public let userId: String
    public let lastReadSeq: Int64
}

/// WebSocket 下行信号
public enum ChatSignal: Decodable {
    case new(groupId: String, seq: Int64)
    case update(groupId: String, seq: Int64, messageId: String)
    case recall(groupId: String, messageId: String)
    case read(groupId: String, userId: String, seq: Int64)
    case ready
    case error(reason: String)
    case unknown

    enum CodingKeys: String, CodingKey { case op, groupId, seq, messageId, userId, reason }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let op = (try? c.decode(String.self, forKey: .op)) ?? ""
        switch op {
        case "new":
            self = .new(groupId: try c.decode(String.self, forKey: .groupId),
                        seq: try c.decode(Int64.self, forKey: .seq))
        case "update":
            self = .update(groupId: try c.decode(String.self, forKey: .groupId),
                           seq: try c.decode(Int64.self, forKey: .seq),
                           messageId: try c.decode(String.self, forKey: .messageId))
        case "recall":
            self = .recall(groupId: try c.decode(String.self, forKey: .groupId),
                           messageId: try c.decode(String.self, forKey: .messageId))
        case "read":
            self = .read(groupId: try c.decode(String.self, forKey: .groupId),
                         userId: try c.decode(String.self, forKey: .userId),
                         seq: try c.decode(Int64.self, forKey: .seq))
        case "ready": self = .ready
        case "error": self = .error(reason: (try? c.decode(String.self, forKey: .reason)) ?? "")
        default: self = .unknown
        }
    }
}
