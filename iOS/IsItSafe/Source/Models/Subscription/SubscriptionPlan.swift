//
//  SubscriptionPlan.swift
//  IsItSafe
//

import Foundation

public struct SubscriptionPlan: Identifiable {
    public let id: String
    public let name: String
    public let productId: String
    public let price: String
    public let period: String

    public static let week = SubscriptionPlan(
        id: "week",
        name: "周订阅",
        productId: ProductIdentifiers.weekSubscription,
        price: "¥12",
        period: "1周"
    )
    public static let month = SubscriptionPlan(
        id: "month",
        name: "月订阅",
        productId: ProductIdentifiers.monthSubscription,
        price: "¥38",
        period: "1个月"
    )
    public static let all: [SubscriptionPlan] = [.week, .month]
}
