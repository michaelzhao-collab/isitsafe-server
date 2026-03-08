//
//  QueryHistoryListResponse.swift
//  IsItSafe
//

import Foundation

public struct QueryHistoryListResponse: Codable {
    public let items: [QueryHistoryItem]
    public let total: Int
    public let page: Int
    public let pageSize: Int
}
