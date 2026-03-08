//
//  ReportService.swift
//  IsItSafe
//

import Foundation

public final class ReportService {
    public static let shared = ReportService()
    private let repo = ReportRepository.shared

    private init() {}

    public func submit(type: ReportType, content: String, relatedQueryId: String? = nil) async throws -> ReportSubmitResponse {
        let req = ReportRequest(type: type, content: content, relatedQueryId: relatedQueryId)
        return try await repo.submit(req)
    }
}
