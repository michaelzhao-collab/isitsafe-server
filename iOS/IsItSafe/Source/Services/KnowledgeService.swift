//
//  KnowledgeService.swift
//  IsItSafe
//

import Foundation

public final class KnowledgeService {
    public static let shared = KnowledgeService()
    private let repo = KnowledgeRepository.shared

    private init() {}

    public func fetchList(category: String?, page: Int, pageSize: Int, search: String?, language: String?) async throws -> KnowledgeListResponse {
        try await repo.list(category: category, page: page, pageSize: pageSize, search: search, language: language ?? "zh")
    }

    public func fetchDetail(id: String) async throws -> KnowledgeDetailResponse {
        try await repo.detail(id: id)
    }
}
