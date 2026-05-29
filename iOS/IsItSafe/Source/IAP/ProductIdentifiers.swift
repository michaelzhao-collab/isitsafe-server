//
//  ProductIdentifiers.swift
//  IsItSafe
//
//  与 App Store Connect 及 Local.storekit 保持一致。
//
//  个人套餐：starlens.weekly/monthly/yearly.subscription
//  家庭套餐：starlens.family.monthly/annual.subscription
//
//  家庭套餐定位（V3 一期 PRD）：
//   - owner 付费 → 同家庭所有成员共享查询不限/天 + 官方提醒不限
//   - 成员侧不需要单独购买；权益分发由 Server 按家庭 owner 的订阅状态计算
//   - familyShareable=false（不走 Apple Family Sharing；我们用自建家庭组）
//

import Foundation

public enum ProductIdentifiers {
    public static let weekSubscription   = "starlens.weekly.subscription"
    public static let monthSubscription  = "starlens.monthly.subscription"
    public static let yearSubscription   = "starlens.yearly.subscription"

    public static let familyMonthly      = "starlens.family.monthly.subscription"
    public static let familyAnnual       = "starlens.family.annual.subscription"

    public static let personal: Set<String> = [weekSubscription, monthSubscription, yearSubscription]
    public static let family:   Set<String> = [familyMonthly, familyAnnual]
    public static let all:      Set<String> = personal.union(family)

    /// 判断给定 productId 是否属于"家庭套餐"
    /// Server 端通过同名 productId 命名约定计算"家庭权益分发"
    public static func isFamilyTier(_ productId: String) -> Bool {
        family.contains(productId)
    }
}
