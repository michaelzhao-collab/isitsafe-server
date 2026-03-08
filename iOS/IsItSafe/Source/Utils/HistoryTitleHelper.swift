//
//  HistoryTitleHelper.swift
//  IsItSafe
//
//  历史记录标题：用户咨询的第一句话提炼为单行显示。
//

import Foundation

public enum HistoryTitleHelper {
    private static let maxLength = 28

    /// 用用户在该条对话中的第一句话（content）提炼为标题，单行显示
    public static func title(for item: QueryHistoryItem) -> String {
        let raw = item.content
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .components(separatedBy: .newlines)
            .first?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? item.content.trimmingCharacters(in: .whitespacesAndNewlines)
        if raw.isEmpty { return "无标题" }
        if raw.count <= maxLength { return raw }
        return String(raw.prefix(maxLength)) + "…"
    }
}
