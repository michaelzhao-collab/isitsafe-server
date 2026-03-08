//
//  QueryRiskCard.swift
//  IsItSafe
//

import SwiftUI

public struct QueryRiskCard: View {
    public let response: QueryRiskResponse

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
            if !response.tags.isEmpty {
                Text("标签：\(response.tags.joined(separator: "、"))")
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
        switch response.riskLevel.lowercased() {
        case "high": return "高风险"
        case "medium": return "中风险"
        default: return "低风险"
        }
    }

    private var riskColor: Color {
        switch response.riskLevel.lowercased() {
        case "high": return AppTheme.riskHigh
        case "medium": return AppTheme.riskMedium
        case "low": return AppTheme.riskLow
        default: return AppTheme.riskUnknown
        }
    }
}
