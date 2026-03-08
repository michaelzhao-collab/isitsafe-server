//
//  QueryRepository.swift
//  IsItSafe
//

import Foundation

public final class QueryRepository {
    public static let shared = QueryRepository()
    private let network = NetworkManager.shared

    private init() {}

    public func queryPhone(_ request: PhoneQueryRequest) async throws -> QueryRiskResponse {
        try await network.request(endpoint: .queryPhone, body: request)
    }

    public func queryURL(_ request: URLQueryRequest) async throws -> QueryRiskResponse {
        try await network.request(endpoint: .queryURL, body: request)
    }

    public func queryCompany(_ request: CompanyQueryRequest) async throws -> QueryRiskResponse {
        try await network.request(endpoint: .queryCompany, body: request)
    }

    public func history(page: Int, pageSize: Int, riskLevel: String?) async throws -> QueryHistoryListResponse {
        try await network.request(endpoint: .queryHistory(page: page, pageSize: pageSize, riskLevel: riskLevel))
    }

    public func deleteQuery(id: String) async throws {
        try await network.requestVoid(endpoint: .deleteQuery(id: id))
    }

    public func tags() async throws -> [String] {
        try await network.request(endpoint: .queryTags)
    }
}
