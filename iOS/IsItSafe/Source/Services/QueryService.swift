//
//  QueryService.swift
//  IsItSafe
//

import Foundation

public final class QueryService {
    public static let shared = QueryService()
    private let repo = QueryRepository.shared
    private let recent = RecentSearchStore.shared

    private init() {}

    public func queryPhone(_ content: String) async throws -> QueryRiskResponse {
        recent.add(content)
        return try await repo.queryPhone(PhoneQueryRequest(content: content))
    }

    public func queryURL(_ content: String) async throws -> QueryRiskResponse {
        recent.add(content)
        return try await repo.queryURL(URLQueryRequest(content: content))
    }

    public func queryCompany(_ content: String) async throws -> QueryRiskResponse {
        recent.add(content)
        return try await repo.queryCompany(CompanyQueryRequest(content: content))
    }

    public func fetchHistory(page: Int, pageSize: Int, riskLevel: String?) async throws -> QueryHistoryListResponse {
        try await repo.history(page: page, pageSize: pageSize, riskLevel: riskLevel)
    }

    public func deleteHistory(id: String) async throws {
        try await repo.deleteQuery(id: id)
    }

    public func fetchTags() async throws -> [String] {
        try await repo.tags()
    }
}
