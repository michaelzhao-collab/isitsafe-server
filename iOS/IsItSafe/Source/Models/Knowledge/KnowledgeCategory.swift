//
//  KnowledgeCategory.swift
//  IsItSafe
//

import Foundation

public struct KnowledgeCategory: Hashable {
    public let id: String
    public let name: String

    public static let all = KnowledgeCategory(id: "", name: "全部")
    public static let categories: [KnowledgeCategory] = [
        .all,
        KnowledgeCategory(id: "钓鱼网站", name: "钓鱼网站"),
        KnowledgeCategory(id: "兼职骗局", name: "兼职骗局"),
        KnowledgeCategory(id: "假客服", name: "假客服"),
        KnowledgeCategory(id: "投资骗局", name: "投资骗局"),
        KnowledgeCategory(id: "老年人骗局", name: "老年人骗局"),
        KnowledgeCategory(id: "诈骗", name: "诈骗"),
        KnowledgeCategory(id: "黑灰产", name: "黑灰产")
    ]
}
