//
//  KnowledgeRepository.swift
//  IsItSafe
//

import Foundation

public final class KnowledgeRepository {
    public static let shared = KnowledgeRepository()
    private let network = NetworkManager.shared

    private init() {}

    public func list(category: String?, page: Int, pageSize: Int, search: String?, language: String?) async throws -> KnowledgeListResponse {
        try await network.request(endpoint: .knowledgeList(category: category, page: page, pageSize: pageSize, search: search, language: language))
    }

    public func detail(id: String) async throws -> KnowledgeDetailResponse {
        try await network.request(endpoint: .knowledgeDetail(id: id))
    }

    public func categories(language: String) async throws -> [KnowledgeCategoryItem] {
        try await network.request(endpoint: .knowledgeCategories(language: language))
    }

    /// V4 案例库举报：成功后该案例对本人立刻隐藏（与情报举报同语义）
    public func report(id: String, reason: String, note: String) async throws {
        struct Body: Encodable { let reason: String; let note: String }
        try await network.requestVoid(
            endpoint: .knowledgeReport(id: id),
            body: Body(reason: reason, note: note)
        )
    }
}
