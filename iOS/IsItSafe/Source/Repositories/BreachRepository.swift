//
//  BreachRepository.swift
//  IsItSafe
//

import Foundation

public final class BreachRepository {
    public static let shared = BreachRepository()
    private let network = NetworkManager.shared
    private init() {}

    public func addTarget(email: String) async throws -> BreachAddTargetResponse {
        try await network.request(endpoint: .v3BreachAddTarget, body: BreachAddTargetRequest(email: email))
    }

    public func listTargets() async throws -> [BreachTargetItem] {
        try await network.request(endpoint: .v3BreachListTargets)
    }

    public func deleteTarget(id: String) async throws {
        try await network.requestVoid(endpoint: .v3BreachDeleteTarget(id: id))
    }

    public func listAlerts() async throws -> [BreachAlert] {
        try await network.request(endpoint: .v3BreachListAlerts)
    }

    public func dismissAlert(id: String) async throws {
        try await network.requestVoid(endpoint: .v3BreachDismissAlert(id: id))
    }
}
