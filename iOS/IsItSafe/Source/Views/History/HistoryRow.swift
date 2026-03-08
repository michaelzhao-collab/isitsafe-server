//
//  HistoryRow.swift
//  IsItSafe
//

import SwiftUI

public struct HistoryRow: View {
    public let item: QueryHistoryItem

    public var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(item.content)
                .font(.subheadline)
                .lineLimit(2)
            HStack {
                Text(item.inputType)
                    .font(.caption)
                    .foregroundColor(.secondary)
                Text(item.riskLevel ?? "")
                    .font(.caption)
                    .foregroundColor(riskColor(item.riskLevel))
                if let date = item.createdAt {
                    Text(Formatter.isoDate(date)?.formatRelative() ?? date)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(.vertical, 8)
    }

    private func riskColor(_ level: String?) -> Color {
        switch level?.lowercased() {
        case "high": return AppTheme.riskHigh
        case "medium": return AppTheme.riskMedium
        case "low": return AppTheme.riskLow
        default: return AppTheme.riskUnknown
        }
    }
}
