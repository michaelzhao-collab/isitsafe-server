//
//  DeepfakeCheck.swift
//  IsItSafe
//
//  V3-A1 语音深伪检测模型
//

import Foundation

public enum DeepfakeLabel: String, Codable {
    case low, medium, high

    public var displayName: String {
        switch self {
        case .low: return L10n.tr(zh: "真人可能性高", en: "Likely a real person")
        case .medium: return L10n.tr(zh: "无法确定", en: "Uncertain")
        case .high: return L10n.tr(zh: "高度怀疑 AI 合成", en: "Highly likely AI-generated")
        }
    }
}

public struct DeepfakeFeature: Codable, Identifiable {
    public let name: String
    public let severity: String   // low / medium / high
    public let description: String

    public var id: String { name }
}

public struct DeepfakeCheck: Codable, Identifiable {
    public let id: String
    public let checkType: String
    public let sourceType: String
    public let fileDurationSec: Int?
    public let resultScore: Double?
    public let resultLabel: DeepfakeLabel?
    public let resultFeatures: [DeepfakeFeature]?
    public let status: String       // queued / processing / done / failed
    public let userFeedback: String?
    public let createdAt: String?
    public let completedAt: String?

    public var scorePercent: Int {
        guard let s = resultScore else { return 0 }
        return Int(s * 100)
    }
}

public struct DeepfakeCreateRequest: Codable {
    public let sourceType: String
    public let fileUrl: String
    public let fileDurationSec: Int?
}

public struct DeepfakeFeedbackRequest: Codable {
    public let feedback: String   // 'accurate' | 'inaccurate'
}
