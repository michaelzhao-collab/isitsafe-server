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
