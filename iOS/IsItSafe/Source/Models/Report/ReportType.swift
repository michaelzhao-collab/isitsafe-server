//
//  ReportType.swift
//  IsItSafe
//

import Foundation

public enum ReportType: String, CaseIterable, Codable {
    case text
    case phone
    case url
    case screenshot

    public var displayName: String {
        switch self {
        case .text: return "文本"
        case .phone: return "电话"
        case .url: return "链接"
        case .screenshot: return "截图"
        }
    }
}
