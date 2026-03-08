//
//  AppSettingsStore.swift
//  IsItSafe
//

import Foundation

public final class AppSettingsStore {
    public static let shared = AppSettingsStore()
    private let envKey = "isitsafe.environment"
    private let langKey = "isitsafe.language"

    private init() {}

    public var environmentRaw: String {
        get { UserDefaults.standard.string(forKey: envKey) ?? AppEnvironmentType.local.rawValue }
        set { UserDefaults.standard.set(newValue, forKey: envKey) }
    }

    public var languageCode: String {
        get { UserDefaults.standard.string(forKey: langKey) ?? "zh" }
        set { UserDefaults.standard.set(newValue, forKey: langKey) }
    }
}
