//
//  SubscriptionStatusResponse.swift
//  IsItSafe
//

import Foundation

public struct SubscriptionStatusResponse: Decodable {
    public let active: Bool
    public let expireTime: String?
    public let productId: String?
    public let status: String?
    public let isPremium: Bool?
    public let planType: String?

    private enum CodingKeys: String, CodingKey {
        case active, status, isPremium, planType
        case expireTime
        case productId
        case expire_time
        case product_id
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        active = try c.decodeIfPresent(Bool.self, forKey: .active) ?? false
        status = try c.decodeIfPresent(String.self, forKey: .status)
        isPremium = try c.decodeIfPresent(Bool.self, forKey: .isPremium)
        planType = try c.decodeIfPresent(String.self, forKey: .planType)
        expireTime = try c.decodeIfPresent(String.self, forKey: .expireTime)
            ?? c.decodeIfPresent(String.self, forKey: .expire_time)
        productId = try c.decodeIfPresent(String.self, forKey: .productId)
            ?? c.decodeIfPresent(String.self, forKey: .product_id)
    }

    public init(
        active: Bool,
        expireTime: String?,
        productId: String?,
        status: String?,
        isPremium: Bool?,
        planType: String?
    ) {
        self.active = active
        self.expireTime = expireTime
        self.productId = productId
        self.status = status
        self.isPremium = isPremium
        self.planType = planType
    }
}
