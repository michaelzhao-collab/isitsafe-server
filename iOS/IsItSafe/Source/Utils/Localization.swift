//
//  Localization.swift
//  IsItSafe
//
//  简单多语言工具：目前支持中文 / 英文 + 跟随系统。
//

import Foundation

public enum AppLanguage: String {
    case system   // 跟随系统
    case zhHans   // 简体中文
    case en       // 英文
}

public enum L10n {
    /// 当前生效语言：根据设置 + 系统语言综合判断
    public static var current: AppLanguage {
        let code = AppSettingsStore.shared.languageCode
        if code == "system" {
            return isSystemChinese ? .zhHans : .en
        }
        if code == "en" { return .en }
        return .zhHans
    }

    private static var isSystemChinese: Bool {
        let lang = Locale.preferredLanguages.first ?? "en"
        return lang.hasPrefix("zh")
    }

    // MARK: - Tab

    public static var tabHome: String {
        switch current {
        case .zhHans: return "问助手"
        case .en: return "Assistant"
        case .system: return "Assistant"
        }
    }

    public static var tabCases: String {
        switch current {
        case .zhHans: return "防诈案例"
        case .en: return "Cases"
        case .system: return "Cases"
        }
    }

    public static var tabProfile: String {
        switch current {
        case .zhHans: return "我的"
        case .en: return "Profile"
        case .system: return "Profile"
        }
    }

    // MARK: - Titles

    public static var titleCases: String {
        switch current {
        case .zhHans: return "防诈案例"
        case .en: return "Scam Cases"
        case .system: return "Scam Cases"
        }
    }

    public static var titleProfile: String {
        switch current {
        case .zhHans: return "我的"
        case .en: return "Profile"
        case .system: return "Profile"
        }
    }

    public static var titleSettings: String {
        switch current {
        case .zhHans: return "系统设置"
        case .en: return "Settings"
        case .system: return "Settings"
        }
    }

    // MARK: - Settings - Language

    public static var settingsLanguage: String {
        switch current {
        case .zhHans: return "语言"
        case .en: return "Language"
        case .system: return "Language"
        }
    }

    public static var languageFollowSystem: String {
        switch current {
        case .zhHans: return "跟随系统"
        case .en: return "System"
        case .system: return "System"
        }
    }

    public static var languageChinese: String {
        switch current {
        case .zhHans: return "中文"
        case .en: return "Chinese"
        case .system: return "Chinese"
        }
    }

    public static var languageEnglish: String {
        switch current {
        case .zhHans: return "英文"
        case .en: return "English"
        case .system: return "English"
        }
    }

    // MARK: - 通用翻译 helper
    /// 提供中英文，自动按当前语言返回。让新代码少写 `if languageCode == "en" {} else {}` 模板
    /// 用法：`L10n.tr(zh: "确认删除", en: "Confirm delete")`
    public static func tr(zh: String, en: String) -> String {
        current == .en ? en : zh
    }

    /// 带占位的格式化版：`L10n.tr(zh: "共 %d 条", en: "%d items", args: 5)`
    public static func tr(zh: String, en: String, args: CVarArg...) -> String {
        let template = current == .en ? en : zh
        return String(format: template, arguments: args)
    }

    /// 复数 helper：根据 count 返回单/复数（仅英文有意义，中文统一）
    /// 用法：`L10n.plural(n, zh: "%d 条记录", enSingular: "%d record", enPlural: "%d records")`
    public static func plural(_ count: Int, zh: String, enSingular: String, enPlural: String) -> String {
        let template = current == .en ? (count == 1 ? enSingular : enPlural) : zh
        return String(format: template, count)
    }
}

// MARK: - String 便捷扩展
public extension String {
    /// 简写：`"确认".l10n(en: "Confirm")`
    /// 不强制迁移所有现有调用点；新代码与重构时优先使用
    func l10n(en: String) -> String {
        L10n.tr(zh: self, en: en)
    }
}

