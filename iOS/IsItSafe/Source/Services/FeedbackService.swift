//
//  FeedbackService.swift
//  IsItSafe
//

import Foundation

public struct FeedbackSubmitRequest: Encodable {
    let content: String
    let imageUrl: String?
    // 不映射 snake_case：服务端 DTO 用 camelCase，
    // 且 class-validator 开了 whitelist 严格模式，多余字段会 400
    // 之前 "image_url" 一直被服务端拒收，所以图片 admin 永远看不到
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
