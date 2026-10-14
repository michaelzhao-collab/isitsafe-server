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
    /// 每日免费次数上限，从服务端 /api/config 同步；默认 7（与 Railway FREE_DAILY_LIMIT 一致，原默认 5 会在首启拉配置失败时提前拦住第 6、7 次）
    public static var maxFreeQueriesPerDay: Int {
        get {
            let v = UserDefaults.standard.integer(forKey: maxFreeQueriesKey)
            return v > 0 ? v : 7
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
        set {
            UserDefaults.standard.set(newValue, forKey: langKey)
            Self.syncSystemUILanguage(newValue)
        }
    }

    // MARK: - 系统界面语言（相机 / 相册选择器 / Sign in with Apple / 系统弹窗）

    /// 系统组件的文案由 App bundle 的首选本地化决定（读 App 域的 AppleLanguages），
    /// 不认 App 内的 isitsafe.language。这里把 App 内语言写进 App 域的 AppleLanguages，
    /// 让系统界面跟随 App 内语言。注意：只在**下次启动**生效（bundle 本地化在进程启动时就定了）。
    /// 要求 bundle 里同时有 en.lproj 与 zh-Hans.lproj（Source/ 下已有 InfoPlist.strings），
    /// 且 Info.plist 声明 CFBundleLocalizations。
    private static let appleLanguagesKey = "AppleLanguages"

    /// App 内语言对应的系统本地化标识
    public static func systemLocalization(for code: String) -> String {
        code == "en" ? "en" : "zh-Hans"
    }

    /// 写入 App 域 AppleLanguages；返回值表示「本次运行中的系统界面语言与目标不一致，需要重启 App 才能切换」
    @discardableResult
    public static func syncSystemUILanguage(_ code: String? = nil) -> Bool {
        let defaults = UserDefaults.standard
        // persistentDomain 只看 App 自己的域，不会把全局（系统设置）的语言列表误当成已设置
        let appDomain = Bundle.main.bundleIdentifier.flatMap { defaults.persistentDomain(forName: $0) }
        let current = appDomain?[appleLanguagesKey] as? [String]

        // 复核 P1：用户在 iOS「设置 › StarLens AI › 首选语言」里改了语言 → App 域 AppleLanguages 变了、
        // 但和我们上次写入的不一致。这时以系统设置为准，反向写回 App 内语言，不能每次启动再改回去。
        if code == nil, let cur = current?.first,
           let last = defaults.string(forKey: lastSyncedAppleLanguageKey), cur != last {
            let fromSettings = cur.hasPrefix("zh") ? "zh" : "en"
            if fromSettings != shared.languageCode {
                defaults.set(fromSettings, forKey: "isitsafe.language")
            }
        }

        var appCode = code ?? shared.languageCode
        // 旧版本可能留下 "system"：按真实系统语言折算，避免被锁成中文
        if appCode != "zh" && appCode != "en" {
            appCode = L10n.isSystemChinese ? "zh" : "en"
        }
        let target = systemLocalization(for: appCode)
        if current != [target] {
            defaults.set([target], forKey: appleLanguagesKey)
        }
        defaults.set(target, forKey: lastSyncedAppleLanguageKey)
        return needsRestartForSystemUILanguage(appCode)
    }

    /// 上次由 App 写入的 AppleLanguages（用来识别「用户在系统设置里改过」）
    private static let lastSyncedAppleLanguageKey = "isitsafe.lastSyncedAppleLanguage"

    /// 当前进程实际使用的系统界面语言是否与 App 内语言不一致
    public static func needsRestartForSystemUILanguage(_ code: String? = nil) -> Bool {
        let target = systemLocalization(for: code ?? shared.languageCode)
        let running = Bundle.main.preferredLocalizations.first ?? ""
        return !(running == target || (target == "zh-Hans" && running.hasPrefix("zh")))
    }

    // MARK: - 免费每日次数

    /// 服务端额度按 UTC 日切（ai-rate-limit.guard dateKey），这里跟着用 UTC——
    /// 原来按设备时区，北京用户 0–8 点用完 7 次后，8 点服务端已放行但本地还「今日额度已用完」误拦最长 16 小时
    private static func todayString() -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC")
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
