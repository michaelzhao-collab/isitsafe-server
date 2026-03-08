//
//  RiskAnalysisRequest.swift
//  IsItSafe
//

import Foundation

public struct RiskAnalysisRequest: Encodable {
    public let content: String
    public let language: String?
    public let country: String?

    public init(content: String, language: String? = "zh", country: String? = nil) {
        self.content = content
        self.language = language
        self.country = country
    }
}
