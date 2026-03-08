//
//  ReportRepository.swift
//  IsItSafe
//

import Foundation

public final class ReportRepository {
    public static let shared = ReportRepository()
    private let network = NetworkManager.shared

    private init() {}

    public func submit(_ request: ReportRequest) async throws -> ReportSubmitResponse {
        try await network.request(endpoint: .reportSubmit, body: request)
    }
}
