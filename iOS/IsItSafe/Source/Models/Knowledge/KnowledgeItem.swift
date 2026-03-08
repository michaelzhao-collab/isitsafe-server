//
//  KnowledgeItem.swift
//  IsItSafe
//

import Foundation

public struct KnowledgeItem: Codable, Identifiable {
    public let id: String
    public let title: String
    public let category: String
    public let content: String
    public let tags: [String]
    public let language: String
    public let source: String?
    public let createdAt: String?
    public let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, title, category, content, tags, language, source
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}
