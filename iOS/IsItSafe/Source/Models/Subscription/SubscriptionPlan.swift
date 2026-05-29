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
    public static let familyMonthly = SubscriptionPlan(
        id: "family_monthly",
        name: "家庭月订阅",
        productId: ProductIdentifiers.familyMonthly,
        price: "¥28",
        period: "1个月 · 全家共享"
    )
    public static let familyAnnual = SubscriptionPlan(
        id: "family_annual",
        name: "家庭年订阅",
        productId: ProductIdentifiers.familyAnnual,
        price: "¥168",
        period: "1年 · 全家共享"
    )
    /// 兜底列表（Server `GET /api/membership/plans` 不可用时用）。
    /// 生产环境实际订阅由后台动态下发。
    public static let all: [SubscriptionPlan] = [.week, .month, .familyMonthly, .familyAnnual]
}
