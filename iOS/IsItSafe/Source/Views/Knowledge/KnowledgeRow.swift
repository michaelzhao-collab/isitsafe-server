//
//  KnowledgeRow.swift
//  IsItSafe
//

import SwiftUI

public struct KnowledgeRow: View {
    public let item: KnowledgeItem

    public var body: some View {
        HStack(alignment: .top, spacing: 12) {
            // 左侧缩略图：V2 接口已派生 firstImage（封面 → 否则正文第一张图），有就显示
            if let thumb = item.thumbnailURL, !thumb.isEmpty {
                CachedNetworkImageView(urlString: thumb, maxWidth: 72, maxHeight: 72)
                    .frame(width: 72, height: 72)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }

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
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.vertical, 8)
    }
}
