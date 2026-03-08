//
//  SubscriptionStatusResponse.swift
//  IsItSafe
//

import Foundation

public struct SubscriptionStatusResponse: Codable {
    public let active: Bool
    public let expireTime: String?
    public let productId: String?
    public let status: String?

    enum CodingKeys: String, CodingKey {
        case active, status
        case expireTime = "expire_time"
        case productId = "product_id"
    }
}
