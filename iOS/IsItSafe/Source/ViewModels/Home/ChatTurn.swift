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
    public var status: TurnStatus

    public init(id: UUID = UUID(), userText: String? = nil, userImage: UIImage? = nil, status: TurnStatus) {
        self.id = id
        self.userText = userText
        self.userImage = userImage
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
