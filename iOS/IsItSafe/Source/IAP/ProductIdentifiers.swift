//
//  ProductIdentifiers.swift
//  IsItSafe
//
//  与 App Store Connect 及 Local.storekit 保持一致：
//  starlens.weekly.subscription / starlens.monthly.subscription / starlens.yearly.subscription
//

import Foundation

public enum ProductIdentifiers {
    public static let weekSubscription  = "starlens.weekly.subscription"
    public static let monthSubscription = "starlens.monthly.subscription"
    public static let yearSubscription  = "starlens.yearly.subscription"
    public static let all: Set<String> = [weekSubscription, monthSubscription, yearSubscription]
}
