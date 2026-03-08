//
//  AppMessageItem.swift
//  IsItSafe
//
//  消息中心单条：标题、内容、跳转链接、发布时间、是否已读。
//

import Foundation

public struct AppMessageItem: Codable, Identifiable {
    public let id: String
    public let title: String
    public let content: String
    public let link: String?
    public let createdAt: String
    public let read: Bool

    public init(id: String, title: String, content: String, link: String?, createdAt: String, read: Bool) {
        self.id = id
        self.title = title
        self.content = content
        self.link = link
        self.createdAt = createdAt
        self.read = read
    }

    enum CodingKeys: String, CodingKey {
        case id, title, content, link, read, createdAt
    }
}

public struct AppMessageListResponse: Codable {
    public let items: [AppMessageItem]
    public let total: Int
    public let page: Int
    public let pageSize: Int
}

public struct MessageUnreadCountResponse: Codable {
    public let count: Int
}
