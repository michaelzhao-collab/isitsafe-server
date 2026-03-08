//
//  RecentSearchStore.swift
//  IsItSafe
//

import Foundation

public final class RecentSearchStore {
    public static let shared = RecentSearchStore()
    private let key = "isitsafe.recentSearch"
    private let maxCount = 20

    private init() {}

    public var recentSearches: [String] {
        get {
            UserDefaults.standard.stringArray(forKey: key) ?? []
        }
        set {
            UserDefaults.standard.set(Array(newValue.prefix(maxCount)), forKey: key)
        }
    }

    public func add(_ text: String) {
        var list = recentSearches.filter { $0 != text }
        list.insert(text, at: 0)
        recentSearches = list
    }

    public func clear() {
        recentSearches = []
    }
}
