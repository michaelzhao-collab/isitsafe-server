//
//  MessageService.swift
//  IsItSafe
//

import Foundation

public final class MessageService {
    public static let shared = MessageService()
    private let network = NetworkManager.shared

    private init() {}

    public func list(page: Int = 1, pageSize: Int = 50) async throws -> AppMessageListResponse {
        try await network.request(endpoint: .messagesList(page: page, pageSize: pageSize))
    }

    public func unreadCount() async -> Int {
        (try? await network.request(endpoint: .messageUnreadCount) as MessageUnreadCountResponse)?.count ?? 0
    }

    public func markRead(id: String) async throws {
        try await network.requestVoid(endpoint: .messageMarkRead(id: id))
    }
}
