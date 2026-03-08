//
//  BaseErrorResponse.swift
//  IsItSafe
//

import Foundation

public struct BaseErrorResponse: Codable {
    public let code: Int?
    public let message: String?
    public let detail: String?
}
