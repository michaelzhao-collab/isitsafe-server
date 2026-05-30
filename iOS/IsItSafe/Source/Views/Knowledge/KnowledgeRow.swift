//
//  KnowledgeRow.swift
//  IsItSafe
//
//  P0-5 布局优化：从平铺列表 → 卡片化设计
//   - 顶部分类 chip（彩色 emoji + 文本）+ 其他 tag chip
//   - 标题加粗 2 行，内容预览 2 行
//   - 底部：缩略图（如有）+ 来源信息
//   - 卡片整体圆角 + 浅边框 + 微阴影
//

import SwiftUI

public struct KnowledgeRow: View {
    public let item: KnowledgeItem

    public var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            // 顶部 chip row：分类 + 其他 tag（最多 2 个，避免视觉杂乱）
            HStack(spacing: 6) {
                categoryChip
                ForEach(item.tags.prefix(2), id: \.self) { tag in
                    tagChip(tag)
                }
                Spacer()
            }

            // 标题
            Text(item.title)
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(AppTheme.textPrimary)
                .lineLimit(2)
                .multilineTextAlignment(.leading)

            // 内容预览
            Text(item.content)
                .font(.system(size: 13))
                .foregroundColor(AppTheme.textSecondary)
                .lineLimit(2)
                .multilineTextAlignment(.leading)

            // 底部：缩略图（如果有）+ 来源
            HStack(spacing: 8) {
                if let thumb = item.thumbnailURL, !thumb.isEmpty {
                    CachedNetworkImageView(urlString: thumb, maxWidth: 44, maxHeight: 44)
                        .frame(width: 44, height: 44)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                Spacer()
                HStack(spacing: 4) {
                    Image(systemName: "book.fill")
                        .font(.caption2)
                    Text(item.source ?? "案例")
                        .font(.caption2)
                }
                .foregroundColor(AppTheme.textSecondary)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppTheme.cardBackground)
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .strokeBorder(AppTheme.textSecondary.opacity(0.08), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .shadow(color: Color.black.opacity(0.04), radius: 4, x: 0, y: 1)
    }

    // MARK: - chips

    /// 分类 chip：emoji + 文本，颜色按分类映射
    private var categoryChip: some View {
        let (emoji, color) = categoryStyle(item.category)
        return HStack(spacing: 4) {
            Text(emoji).font(.caption2)
            Text(item.category)
                .font(.caption2.weight(.semibold))
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 3)
        .background(color.opacity(0.13))
        .foregroundColor(color)
        .clipShape(Capsule())
    }

    private func tagChip(_ tag: String) -> some View {
        Text(tag)
            .font(.caption2)
            .foregroundColor(AppTheme.textSecondary)
            .padding(.horizontal, 7)
            .padding(.vertical, 2)
            .background(AppTheme.textSecondary.opacity(0.08))
            .clipShape(Capsule())
    }

    /// 按分类名前缀关键词映射 (emoji, color)
    /// 关键词匹配数据里实际的 category 字符串
    private func categoryStyle(_ category: String) -> (String, Color) {
        let c = category
        if c.contains("钓鱼") || c.contains("链接") || c.contains("phishing") {
            return ("🎣", AppTheme.primary)
        }
        if c.contains("假客服") || c.contains("公检法") || c.contains("冒充") {
            return ("📞", AppTheme.riskHigh)
        }
        if c.contains("兼职") || c.contains("刷单") {
            return ("💼", AppTheme.riskMedium)
        }
        if c.contains("投资") || c.contains("理财") || c.contains("股票") {
            return ("📈", Color(red: 0.55, green: 0.32, blue: 0.85))
        }
        if c.contains("老年") || c.contains("保健") {
            return ("🧓", Color(red: 0.95, green: 0.55, blue: 0.20))
        }
        if c.contains("杀猪盘") || c.contains("网恋") || c.contains("romance") {
            return ("💔", Color(red: 0.92, green: 0.30, blue: 0.50))
        }
        if c.contains("快递") || c.contains("物流") || c.contains("package") {
            return ("📦", Color(red: 0.20, green: 0.70, blue: 0.85))
        }
        if c.contains("黑灰产") || c.contains("加密") || c.contains("数字") {
            return ("🔐", Color(red: 0.40, green: 0.40, blue: 0.55))
        }
        // 默认
        return ("⚠️", AppTheme.textSecondary)
    }
}
