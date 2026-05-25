//
//  MembershipPlanResponse.swift
//  IsItSafe
//
//  与 GET /api/membership/plans 返回一致（后台配置的套餐列表）。
//

import Foundation

public struct MembershipPlanResponse: Codable {
    public let name: String
    public let productId: String
    public let price: Double
    public let currency: String
    public let period: String
    public let introPrice: Double?
    public let introPeriod: String?
    public let firstPurchaseOnly: Bool?
    public let isRecommended: Bool?

    public init(
        name: String,
        productId: String,
        price: Double,
        currency: String,
        period: String,
        introPrice: Double? = nil,
        introPeriod: String? = nil,
        firstPurchaseOnly: Bool? = nil,
        isRecommended: Bool?
    ) {
        self.name = name
        self.productId = productId
        self.price = price
        self.currency = currency
        self.period = period
        self.introPrice = introPrice
        self.introPeriod = introPeriod
        self.firstPurchaseOnly = firstPurchaseOnly
        self.isRecommended = isRecommended
    }
}
