//
//  InputClassifier.swift
//  IsItSafe
//
//  客户端前置输入分类：根据内容判断应调用 text 分析 / phone / url / company 查询。
//

import Foundation

public enum InputClassification {
    case text
    case phone
    case url
    case company
    case screenshot
}

public enum QueryInputClassification {
    case aiText
    case aiScreenshot
    case queryPhone
    case queryURL
    case queryCompany
}

public final class InputClassifier {
    private static let companyKeywords = ["公司", "平台", "投资", "理财", "基金", "贷款", "网贷", "交易所", "app", "软件", "官网", "客服", "机构", "集团", "控股"]

    public static func classify(_ content: String, isScreenshot: Bool = false) -> QueryInputClassification {
        if isScreenshot { return .aiScreenshot }
        let trimmed = content.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return .aiText }
        let lower = trimmed.lowercased()
        if trimmed.hasPrefix("http://") || trimmed.hasPrefix("https://") { return .queryURL }
        if lower.contains("www.") || lower.range(of: #"\.[a-z]{2,}(\/|$)"#, options: .regularExpression) != nil { return .queryURL }
        let digitsOnly = trimmed.replacingOccurrences(of: " ", with: "").replacingOccurrences(of: "-", with: "").replacingOccurrences(of: "+", with: "")
        if digitsOnly.count >= 7 && digitsOnly.count <= 15 && digitsOnly.allSatisfy({ $0.isNumber || $0 == "+" }) { return .queryPhone }
        if digitsOnly.count == 11 && digitsOnly.hasPrefix("1") { return .queryPhone }
        if companyKeywords.contains(where: { lower.contains($0) }) { return .queryCompany }
        return .aiText
    }
}
