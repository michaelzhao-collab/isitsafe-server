//
//  AppConfiguration.swift
//  IsItSafe
//
//  全局配置：当前环境、baseURL 等，从 AppEnvironment 读取。
//

import Foundation

public final class AppConfiguration {
    public static let shared = AppConfiguration()

    /// 当前环境（可从 AppSettingsStore 持久化读取，默认 local）
    public var currentEnvironment: AppEnvironment {
        get {
            let raw = AppSettingsStore.shared.environmentRaw
            let type = AppEnvironmentType(rawValue: raw) ?? .local
            return AppEnvironment.environment(for: type)
        }
        set {
            AppSettingsStore.shared.environmentRaw = newValue.type.rawValue
        }
    }

    public var baseURL: String { currentEnvironment.baseURL }
    public var apiTimeout: TimeInterval { currentEnvironment.timeout }
    public var enableLogging: Bool { currentEnvironment.enableLogging }

    private init() {}
}
