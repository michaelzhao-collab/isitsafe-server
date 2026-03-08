//
//  KnowledgeListResponse.swift
//  IsItSafe
//

import Foundation

public struct KnowledgeListResponse: Codable {
    public let items: [KnowledgeItem]
    public let total: Int
    public let page: Int
    public let pageSize: Int
}
