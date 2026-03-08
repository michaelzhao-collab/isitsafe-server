//
//  RiskResultCard.swift
//  IsItSafe
//

import SwiftUI

public struct RiskResultCard: View {
    public let data: RiskAnalysisViewData

    public init(data: RiskAnalysisViewData) {
        self.data = data
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(data.riskLevelDisplay)
                    .font(.headline)
                    .foregroundColor(riskColor)
                Spacer()
                if let score = data.score {
                    Text("得分 \(score)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            Text(data.summary)
                .font(.body)
            if !data.reasons.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("原因")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    ForEach(data.reasons, id: \.self) { Text("• \($0)").font(.subheadline) }
                }
            }
            if !data.advice.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("建议")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    ForEach(data.advice, id: \.self) { Text("• \($0)").font(.subheadline) }
                }
            }
        }
        .padding()
        .background(AppTheme.cardBackground)
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.05), radius: 4, x: 0, y: 2)
    }

    private var riskColor: Color {
        switch data.riskLevel.lowercased() {
        case "high": return AppTheme.riskHigh
        case "medium": return AppTheme.riskMedium
        case "low": return AppTheme.riskLow
        default: return AppTheme.riskUnknown
        }
    }
}
