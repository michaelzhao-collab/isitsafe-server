//
//  ChatTurn.swift
//  IsItSafe
//
//  单轮对话：用户内容（右）+ 分析中/回复（左）。
//

import Foundation
import UIKit

public struct ChatTurn: Identifiable {
    public let id: UUID
    public var userText: String?
    public var userImage: UIImage?
    /// 历史记录中的图片 CDN 地址，无 userImage 时用此加载展示
    public var imageUrl: String?
    public var status: TurnStatus

    public init(id: UUID = UUID(), userText: String? = nil, userImage: UIImage? = nil, imageUrl: String? = nil, status: TurnStatus) {
        self.id = id
        self.userText = userText
        self.userImage = userImage
        self.imageUrl = imageUrl
        self.status = status
    }

    /// 从服务端 row id（cuid/字符串）生成稳定 UUID，避免历史回放时 ForEach 因 id 变化整行重绘
    /// 同一服务端 id 永远映射到同一 UUID（基于内容哈希），无需持久化
    public static func stableId(from serverId: String) -> UUID {
        if let direct = UUID(uuidString: serverId) {
            return direct
        }
        // 非 UUID 格式（如 cuid）→ MD5 截取 16 字节构造 UUID（V3-like，仅用于本地稳定性）
        let bytes: [UInt8] = Array(serverId.utf8)
        var hash: [UInt8] = Array(repeating: 0, count: 16)
        // 简易混合（非密码学用途，仅追求稳定性）
        for (i, b) in bytes.enumerated() {
            hash[i % 16] = hash[i % 16] &+ b &+ UInt8(i & 0xFF)
        }
        return UUID(uuid: (
            hash[0], hash[1], hash[2], hash[3],
            hash[4], hash[5], hash[6], hash[7],
            hash[8], hash[9], hash[10], hash[11],
            hash[12], hash[13], hash[14], hash[15]
        ))
    }

    public var isAnalyzing: Bool {
        if case .analyzing = status { return true }
        return false
    }

    public var result: ChatTurnResult? {
        if case .done(let r) = status { return r }
        return nil
    }
}

public enum TurnStatus {
    case analyzing
    case done(ChatTurnResult)
}

public enum ChatTurnResult {
    case analysis(RiskAnalysisViewData)
    case query(QueryRiskResponse)
    case failure(String)
}
