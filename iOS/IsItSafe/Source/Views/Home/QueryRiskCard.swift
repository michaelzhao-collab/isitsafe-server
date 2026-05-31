//
//  QueryRiskCard.swift
//  IsItSafe
//

import SwiftUI

public struct QueryRiskCard: View {
    public let response: QueryRiskResponse
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"

    public init(response: QueryRiskResponse) {
        self.response = response
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(riskDisplay)
                    .font(.headline)
                    .foregroundColor(riskColor)
                Spacer()
            }
            if let tags = response.tags, !tags.isEmpty {
                let sep = languageCode == "en" ? ", " : "、"
                let prefix = languageCode == "en" ? "Tags: " : "标签："
                Text("\(prefix)\(tags.joined(separator: sep))")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .background(AppTheme.cardBackground)
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.05), radius: 4, x: 0, y: 2)
    }

    private var riskDisplay: String {
        let level = response.riskLevel?.lowercased() ?? "unknown"
        let isZh = languageCode != "en"
        switch level {
        case "high": return isZh ? "高风险" : "High risk"
        case "medium": return isZh ? "中风险" : "Medium risk"
        case "low": return isZh ? "低风险" : "Low risk"
        default: return isZh ? "未知" : "Unknown"
        }
    }

    private var riskColor: Color {
        let level = response.riskLevel?.lowercased() ?? "unknown"
        switch level {
        case "high": return AppTheme.riskHigh
        case "medium": return AppTheme.riskMedium
        case "low": return AppTheme.riskLow
        default: return AppTheme.riskUnknown
        }
    }
}
