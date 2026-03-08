//
//  CompanyQueryRequest.swift
//  IsItSafe
//

import Foundation

public struct CompanyQueryRequest: Encodable {
    public let content: String
    public init(content: String) { self.content = content }
}
