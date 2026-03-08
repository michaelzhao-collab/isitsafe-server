//
//  ReportRequest.swift
//  IsItSafe
//

import Foundation

public struct ReportRequest: Encodable {
    public let type: String
    public let content: String
    public let relatedQueryId: String?

    public init(type: ReportType, content: String, relatedQueryId: String? = nil) {
        self.type = type.rawValue
        self.content = content
        self.relatedQueryId = relatedQueryId
    }
}
