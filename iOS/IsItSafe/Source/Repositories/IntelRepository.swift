//
//  IntelRepository.swift
//  IsItSafe
//
//  V3-B 情报推送：纯网络层
//

import Foundation

public final class IntelRepository {
    public static let shared = IntelRepository()
    private let network = NetworkManager.shared

    private init() {}

    public func getFeed(limit: Int = 30, language: String? = nil) async throws -> [IntelAlertSummary] {
        try await network.request(endpoint: .v3IntelFeed(limit: limit, language: language))
    }

    public func getDetail(id: String) async throws -> IntelAlertDetail {
        try await network.request(endpoint: .v3IntelDetail(id: id))
    }

    public func getCategories(language: String?) async throws -> [IntelCategory] {
        try await network.request(endpoint: .v3IntelCategories(language: language))
    }

    public func getUnreadCount() async throws -> Int {
        let r: IntelUnreadCountResponse = try await network.request(endpoint: .v3IntelUnreadCount)
        return r.count
    }

    public func submit(_ request: IntelSubmitRequest) async throws -> IntelSubmissionResponse {
        try await network.request(endpoint: .v3IntelSubmit, body: request)
    }

    public func getPreferences() async throws -> IntelPreferences {
        try await network.request(endpoint: .v3IntelGetPreferences)
    }

    public func updatePreferences(_ request: IntelPreferencesUpdateRequest) async throws -> IntelPreferences {
        try await network.request(endpoint: .v3IntelPutPreferences, body: request)
    }

    /// V4-P4 举报某条情报；reason: spam/inaccurate/illegal/offensive/other
    public func report(intelId: String, reason: String, note: String?) async throws {
        struct Body: Codable { let reason: String; let note: String? }
        try await network.requestVoid(
            endpoint: .v3IntelReport(intelId: intelId),
            body: Body(reason: reason, note: note?.isEmpty == true ? nil : note)
        )
    }
}
