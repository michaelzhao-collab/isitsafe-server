//
//  URLQueryRequest.swift
//  IsItSafe
//

import Foundation

public struct URLQueryRequest: Encodable {
    public let content: String
    public init(content: String) { self.content = content }
}
