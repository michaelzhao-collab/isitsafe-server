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

    public static var week: SubscriptionPlan {
        SubscriptionPlan(
            id: "week",
            name: L10n.tr(zh: "周订阅", en: "Weekly"),
            productId: ProductIdentifiers.weekSubscription,
            price: "¥12",
            period: L10n.tr(zh: "1周", en: "1 week")
        )
    }
    public static var month: SubscriptionPlan {
        SubscriptionPlan(
            id: "month",
            name: L10n.tr(zh: "月订阅", en: "Monthly"),
            productId: ProductIdentifiers.monthSubscription,
            price: "¥38",
            period: L10n.tr(zh: "1个月", en: "1 month")
        )
    }
    public static var familyMonthly: SubscriptionPlan {
        SubscriptionPlan(
            id: "family_monthly",
            name: L10n.tr(zh: "家庭月订阅", en: "Family Monthly"),
            productId: ProductIdentifiers.familyMonthly,
            price: "¥28",
            period: L10n.tr(zh: "1个月 · 全家共享", en: "1 month · Family sharing")
        )
    }
    public static var familyAnnual: SubscriptionPlan {
        SubscriptionPlan(
            id: "family_annual",
            name: L10n.tr(zh: "家庭年订阅", en: "Family Annual"),
            productId: ProductIdentifiers.familyAnnual,
            price: "¥168",
            period: L10n.tr(zh: "1年 · 全家共享", en: "1 year · Family sharing")
        )
    }
    /// 兜底列表（Server `GET /api/membership/plans` 不可用时用）。
    /// 生产环境实际订阅由后台动态下发。
    public static var all: [SubscriptionPlan] { [.week, .month, .familyMonthly, .familyAnnual] }
}
