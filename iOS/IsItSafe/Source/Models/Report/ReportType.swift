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
        case .text: return L10n.tr(zh: "文本", en: "Text")
        case .phone: return L10n.tr(zh: "电话", en: "Phone")
        case .url: return L10n.tr(zh: "链接", en: "Link")
        case .screenshot: return L10n.tr(zh: "截图", en: "Screenshot")
        }
    }
}
