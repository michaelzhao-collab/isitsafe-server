//
//  PhoneQueryRequest.swift
//  IsItSafe
//

import Foundation

public struct PhoneQueryRequest: Encodable {
    public let content: String
    public init(content: String) { self.content = content }
}
