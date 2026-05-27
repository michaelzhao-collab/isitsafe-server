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
    /// 文章结构化内容（TipTap JSON）。null 表示旧版纯文本案例，渲染时降级用 content 字段
    /// V2 列表接口不返回此字段（slim），仅详情接口返回
    public let contentBlocks: JSONValue?
    /// 封面图 R2 URL
    public let coverImage: String?
    /// V2 列表派生字段：是否含富文本（用于列表展示样式区分）
    public let hasContentBlocks: Bool?
    /// V2 列表派生字段：缩略图 URL（优先 coverImage，否则取正文第一张图）
    public let firstImage: String?

    enum CodingKeys: String, CodingKey {
        case id, title, category, content, tags, language, source
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        // Prisma 直接返回 camelCase 键名，与 Swift 属性名一致，无需 map
        case contentBlocks
        case coverImage
        case hasContentBlocks
        case firstImage
    }

    /// 列表展示用缩略图：优先后端派生 firstImage，否则 coverImage
    public var thumbnailURL: String? {
        firstImage ?? coverImage
    }
}
