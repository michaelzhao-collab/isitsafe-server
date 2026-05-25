//
//  FeedbackService.swift
//  IsItSafe
//

import Foundation

public struct FeedbackSubmitRequest: Encodable {
    let content: String
    let imageUrl: String?

    enum CodingKeys: String, CodingKey {
        case content
        case imageUrl = "image_url"
    }
}

public final class FeedbackService {
    public static let shared = FeedbackService()
    private let network = NetworkManager.shared

    private init() {}

    public func submit(content: String, imageUrl: String?) async throws {
        let body = FeedbackSubmitRequest(content: content, imageUrl: imageUrl)
        try await network.requestVoid(endpoint: .feedbackSubmit, body: body)
    }
}
