//
//  KnowledgeRow.swift
//  IsItSafe
//

import SwiftUI

public struct KnowledgeRow: View {
    public let item: KnowledgeItem

    public var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(item.title)
                .font(.headline)
            Text(item.content)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .lineLimit(2)
            if !item.tags.isEmpty {
                Text(item.tags.joined(separator: " · "))
                    .font(.caption)
                    .foregroundColor(.blue)
            }
        }
        .padding(.vertical, 8)
    }
}
