//
//  KnowledgeCategory.swift
//  IsItSafe
//

import Foundation

public struct KnowledgeCategoryItem: Hashable, Codable, Identifiable {
    public let id: String        // 对应后端 key
    public let name: String      // 已根据语言处理后的展示名称
}
