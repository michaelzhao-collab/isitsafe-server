//
//  PaginationResponse.swift
//  IsItSafe
//

import Foundation

public struct PaginationResponse<T: Codable>: Codable {
    public let items: T
    public let total: Int
    public let page: Int
    public let pageSize: Int
}
