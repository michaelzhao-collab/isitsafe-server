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
}
