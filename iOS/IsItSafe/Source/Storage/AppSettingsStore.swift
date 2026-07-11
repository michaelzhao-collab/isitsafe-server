//
//  AppSettingsStore.swift
//  IsItSafe
//

import Foundation

public final class AppSettingsStore {
    public static let shared = AppSettingsStore()
    private let envKey = "isitsafe.environment"
    private let langKey = "isitsafe.language"
    private let freeQueryDateKey = "isitsafe.freeQueryDate"
    private let freeQueryCountKey = "isitsafe.freeQueryCount"
    private static let maxFreeQueriesKey = "isitsafe.maxFreeQueriesPerDay"
    /// 每日免费次数上限，从服务端 /api/config 同步，默认 5
    public static var maxFreeQueriesPerDay: Int {
        get {
            let v = UserDefaults.standard.integer(forKey: maxFreeQueriesKey)
            return v > 0 ? v : 5
        }
        set { UserDefaults.standard.set(newValue, forKey: maxFreeQueriesKey) }
    }

    /// V5.1 家庭 IM 开关键（UserDefaults key 供 @AppStorage 观察）
    public static let familyChatEnabledKey = "isitsafe.familyChatEnabled"
    /// 家庭群聊是否启用：由服务端 /api/config 的 familyChatEnabled 决定。
    /// **默认 false** —— 服务端未部署 / 未返回该字段 / 显式关闭时，客户端回退老家庭页、不连 WebSocket，
    /// 保证新包连到未就绪的服务端也不报错、家庭页正常。
    public static var familyChatEnabled: Bool {
        get { UserDefaults.standard.bool(forKey: familyChatEnabledKey) }
        set { UserDefaults.standard.set(newValue, forKey: familyChatEnabledKey) }
    }

    private init() {
        // 首次启动：根据系统语言设置默认语言（中文系统→中文；非中文系统→英文）
        if UserDefaults.standard.string(forKey: langKey) == nil {
            let preferred = Locale.preferredLanguages.first ?? "en"
            let isZh = preferred.hasPrefix("zh")
            UserDefaults.standard.set(isZh ? "zh" : "en", forKey: langKey)
        }
    }

    public var environmentRaw: String {
        get { UserDefaults.standard.string(forKey: envKey) ?? AppEnvironmentType.productionCN.rawValue }
        set { UserDefaults.standard.set(newValue, forKey: envKey) }
    }

    public var languageCode: String {
        get { UserDefaults.standard.string(forKey: langKey) ?? "zh" }
        set { UserDefaults.standard.set(newValue, forKey: langKey) }
    }

    // MARK: - 免费每日次数

    private static func todayString() -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: Date())
    }

    /// 今日已使用次数
    public var freeQueryCountToday: Int {
        let today = Self.todayString()
        guard UserDefaults.standard.string(forKey: freeQueryDateKey) == today else { return 0 }
        return UserDefaults.standard.integer(forKey: freeQueryCountKey)
    }

    /// 是否已耗尽今日免费次数
    public func isFreeQuotaExhausted() -> Bool {
        return freeQueryCountToday >= Self.maxFreeQueriesPerDay
    }

    /// 成功完成一次查询后调用
    public func incrementFreeQueryCount() {
        let today = Self.todayString()
        if UserDefaults.standard.string(forKey: freeQueryDateKey) != today {
            UserDefaults.standard.set(today, forKey: freeQueryDateKey)
            UserDefaults.standard.set(1, forKey: freeQueryCountKey)
        } else {
            let count = UserDefaults.standard.integer(forKey: freeQueryCountKey)
            UserDefaults.standard.set(count + 1, forKey: freeQueryCountKey)
        }
    }

    /// 切账号时清空：登出 / 登入新账号都要调，避免上个用户的计数串到下个用户
    /// 原 bug：UserDefaults 全局存计数没按 userId 隔离，新用户上来就显示 7/7
    public func resetFreeQueryCount() {
        UserDefaults.standard.removeObject(forKey: freeQueryDateKey)
        UserDefaults.standard.removeObject(forKey: freeQueryCountKey)
    }
}
