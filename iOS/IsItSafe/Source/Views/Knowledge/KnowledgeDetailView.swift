//
//  KnowledgeDetailView.swift
//  IsItSafe
//
//  布局优化：分类 chip + 大标题 + 信息行 + 正文行距加大
//

import SwiftUI

public struct KnowledgeDetailView: View {
    @StateObject private var vm: KnowledgeDetailViewModel
    private let id: String
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"

    public init(id: String) {
        self.id = id
        _vm = StateObject(wrappedValue: KnowledgeDetailViewModel())
    }

    public var body: some View {
        Group {
            if case .loading = vm.state, vm.item == nil {
                ZStack {
                    AppTheme.background
                    ProgressView(languageCode == "en" ? "Loading..." : "加载中...")
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if case .failure = vm.state, vm.item == nil {
                ErrorStateView(message: languageCode == "en" ? "Failed to load" : "加载失败",
                               retry: { vm.load(id: id) })
            } else if let item = vm.item {
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        // 封面图（可选）
                        if let cover = item.coverImage, let url = URL(string: cover) {
                            AsyncImage(url: url) { phase in
                                if let img = phase.image {
                                    img.resizable().scaledToFill()
                                } else {
                                    Color(.secondarySystemBackground)
                                }
                            }
                            .frame(maxWidth: .infinity, minHeight: 180, maxHeight: 220)
                            .clipped()
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        }

                        // 头部：分类 chip + 大标题 + 来源 / 日期
                        VStack(alignment: .leading, spacing: 10) {
                            categoryChip(for: item.category)
                            Text(item.title)
                                .font(.system(size: 22, weight: .bold))
                                .foregroundColor(AppTheme.textPrimary)
                                .lineSpacing(2)
                            metaRow(for: item)
                        }

                        Divider()

                        // 正文：优先用结构化 blocks 渲染，否则 fallback 纯文本
                        let blocks = ArticleBlockParser.parse(item.contentBlocks)
                        if !blocks.isEmpty {
                            ArticleRendererView(blocks: blocks)
                        } else {
                            Text(item.content)
                                .font(.system(size: 16))
                                .lineSpacing(7)
                                .foregroundColor(AppTheme.textPrimary)
                                .fixedSize(horizontal: false, vertical: true)
                        }

                        if !item.tags.isEmpty {
                            tagsSection(item.tags)
                        }

                        // 底部"来源"提示行：不可点击；只在有 source 时出现
                        if let src = item.source, !src.isEmpty {
                            sourceFooter(src: src)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(20)
                    .padding(.bottom, 40)
                }
            }
        }
        .background(AppTheme.background)
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { vm.load(id: id) }
    }

    private func categoryChip(for category: String) -> some View {
        let (emoji, color) = categoryStyle(category)
        return HStack(spacing: 5) {
            Text(emoji).font(.caption2)
            Text(categoryDisplayName(category))
                .font(.caption.weight(.semibold))
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
        .background(color.opacity(0.13))
        .foregroundColor(color)
        .clipShape(Capsule())
    }

    /// 底部"来源"行：纯文本提示，不可点击
    private func sourceFooter(src: String) -> some View {
        HStack(spacing: 4) {
            Text(languageCode == "en" ? "Source:" : "来源：")
                .font(.caption2)
                .foregroundColor(AppTheme.textSecondary)
            Text(src)
                .font(.caption2)
                .foregroundColor(AppTheme.textSecondary)
                .lineLimit(1)
                .truncationMode(.middle)
            Spacer(minLength: 0)
        }
        .padding(.top, 12)
    }

    private func metaRow(for item: KnowledgeItem) -> some View {
        HStack(spacing: 10) {
            if let source = item.source, !source.isEmpty {
                HStack(spacing: 4) {
                    Image(systemName: "doc.text")
                        .font(.caption2)
                    Text(source).font(.caption)
                }
                .foregroundColor(AppTheme.textSecondary)
            }
            if let created = item.createdAt {
                Text("·").foregroundColor(AppTheme.textSecondary)
                Text(formatDate(created)).font(.caption)
                    .foregroundColor(AppTheme.textSecondary)
            }
            Spacer()
        }
    }

    private func tagsSection(_ tags: [String]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(languageCode == "en" ? "Related tags" : "相关标签")
                .font(.caption.weight(.semibold))
                .foregroundColor(AppTheme.textSecondary)
            FlowLayout(spacing: 6) {
                ForEach(tags, id: \.self) { tag in
                    Text(tag)
                        .font(.caption)
                        .padding(.horizontal, 8).padding(.vertical, 4)
                        .background(AppTheme.textSecondary.opacity(0.08))
                        .foregroundColor(AppTheme.textSecondary)
                        .clipShape(Capsule())
                }
            }
        }
        .padding(.top, 8)
    }

    private func formatDate(_ iso: String) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let d = f.date(from: iso) ?? {
            let f2 = ISO8601DateFormatter()
            f2.formatOptions = [.withInternetDateTime]
            return f2.date(from: iso)
        }()
        guard let date = d else { return "" }
        let out = DateFormatter()
        out.dateStyle = .medium
        out.timeStyle = .none
        out.locale = Locale(identifier: languageCode == "en" ? "en_US" : "zh_CN")
        return out.string(from: date)
    }

    // MARK: - category 映射（与 KnowledgeRow 保持一致）

    private func categoryStyle(_ category: String) -> (String, Color) {
        let c = category.lowercased()
        if c.contains("phishing") || c.contains("钓鱼") { return ("🎣", AppTheme.primary) }
        if c.contains("impersonation") || c.contains("假客服") || c.contains("公检法") || c.contains("冒充") { return ("📞", AppTheme.riskHigh) }
        if c.contains("job") || c.contains("兼职") || c.contains("刷单") { return ("💼", AppTheme.riskMedium) }
        if c.contains("invest") || c.contains("投资") || c.contains("理财") || c.contains("股票") { return ("📈", Color(red: 0.55, green: 0.32, blue: 0.85)) }
        if c.contains("elder") || c.contains("老年") || c.contains("保健") { return ("🧓", Color(red: 0.95, green: 0.55, blue: 0.20)) }
        if c.contains("romance") || c.contains("杀猪") || c.contains("网恋") { return ("💔", Color(red: 0.92, green: 0.30, blue: 0.50)) }
        if c.contains("package") || c.contains("快递") || c.contains("物流") { return ("📦", Color(red: 0.20, green: 0.70, blue: 0.85)) }
        if c.contains("crypto") || c.contains("加密") || c.contains("数字") || c.contains("黑灰") { return ("🔐", Color(red: 0.40, green: 0.40, blue: 0.55)) }
        if c.contains("scam") || c.contains("诈骗") { return ("⚠️", AppTheme.riskHigh) }
        return ("⚠️", AppTheme.textSecondary)
    }

    private func categoryDisplayName(_ category: String) -> String {
        let key = category.lowercased()
        let map: [String: (zh: String, en: String)] = [
            "scam": ("诈骗", "Scam"),
            "phishing": ("钓鱼", "Phishing"),
            "investment_scam": ("投资骗局", "Investment Scam"),
            "investment": ("投资骗局", "Investment Scam"),
            "job_scam": ("兼职骗局", "Job Scam"),
            "job": ("兼职骗局", "Job Scam"),
            "impersonation": ("冒充客服", "Impersonation"),
            "fake_customer_service": ("假客服", "Fake CS"),
            "elder_scam": ("老年人骗局", "Elder Scam"),
            "elder": ("老年人骗局", "Elder Scam"),
            "romance": ("杀猪盘", "Romance Scam"),
            "package": ("快递诈骗", "Package Scam"),
            "crypto": ("加密货币", "Crypto"),
            "black_market": ("黑灰产", "Black Market"),
        ]
        if let pair = map[key] {
            return languageCode == "en" ? pair.en : pair.zh
        }
        return category
    }
}

/// 简单的 FlowLayout 实现：自动换行的横向 chip 流
/// 旧的 ForEach inside HStack 不能换行；用这个支持多标签自动 wrap
private struct FlowLayout: Layout {
    var spacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var rows: [(width: CGFloat, height: CGFloat)] = []
        var currentRow: (width: CGFloat, height: CGFloat) = (0, 0)
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if currentRow.width + size.width + spacing > maxWidth, currentRow.width > 0 {
                rows.append(currentRow)
                currentRow = (size.width, size.height)
            } else {
                currentRow.width += size.width + (currentRow.width == 0 ? 0 : spacing)
                currentRow.height = max(currentRow.height, size.height)
            }
        }
        rows.append(currentRow)
        let totalHeight = rows.reduce(0) { $0 + $1.height } + spacing * CGFloat(max(0, rows.count - 1))
        let totalWidth = rows.map(\.width).max() ?? 0
        return CGSize(width: min(totalWidth, maxWidth), height: totalHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX
        var y = bounds.minY
        var rowHeight: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > bounds.maxX, x > bounds.minX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            subview.place(at: CGPoint(x: x, y: y), proposal: .unspecified)
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}
