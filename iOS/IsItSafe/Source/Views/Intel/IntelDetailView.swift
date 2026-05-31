//
//  IntelDetailView.swift
//  IsItSafe
//
//  V3-B 情报详情页（含 TipTap 结构化内容渲染 + 来源 + 时间）
//

import SwiftUI

public struct IntelDetailView: View {
    public let summary: IntelAlertSummary
    @Environment(\.dismiss) private var dismiss
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    @State private var detail: IntelAlertDetail?
    @State private var loading = true
    @State private var errorMessage: String?

    public init(summary: IntelAlertSummary) { self.summary = summary }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                severityBadge
                titleSection
                if let d = detail {
                    summarySection(d: d)
                    if let blocks = d.contentBlocks {
                        // 复用 V2 ArticleRendererView（接受 [ArticleBlock]）
                        // 如果格式兼容直接渲染；否则回退展示纯文本
                        ArticleRendererView(blocks: ArticleBlockParser.parse(blocks))
                    }
                    if let src = d.sourceUrl, !src.isEmpty {
                        sourceLink(src: src)
                    }
                } else if loading {
                    HStack { Spacer(); ProgressView(); Spacer() }.padding()
                } else if let err = errorMessage {
                    Text(err).font(.caption).foregroundColor(AppTheme.riskHigh)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
        }
        .background(AppTheme.background.ignoresSafeArea())
        .navigationTitle(languageCode == "en" ? "Intel" : "情报详情")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private var severityBadge: some View {
        HStack {
            Text(summary.severity.displayName)
                .font(.caption.weight(.bold))
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(badgeColor.opacity(0.15))
                .foregroundColor(badgeColor)
                .clipShape(Capsule())
            Text(summary.category)
                .font(.caption)
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(Color(.systemGray6))
                .clipShape(Capsule())
            Spacer()
            if let pub = summary.publishedAt {
                Text(relativeTime(iso: pub))
                    .font(.caption)
                    .foregroundColor(AppTheme.textSecondary)
            }
        }
    }

    private var badgeColor: Color {
        switch summary.severity {
        case .urgent: return AppTheme.riskHigh
        case .high: return AppTheme.riskMedium
        case .normal: return AppTheme.primary
        }
    }

    private var titleSection: some View {
        Text(summary.title)
            .font(.title3.weight(.bold))
            .foregroundColor(AppTheme.textPrimary)
            .fixedSize(horizontal: false, vertical: true)
    }

    private func summarySection(d: IntelAlertDetail) -> some View {
        Text(d.summary)
            .font(.body)
            .foregroundColor(AppTheme.textPrimary)
            .lineSpacing(4)
            .fixedSize(horizontal: false, vertical: true)
    }

    /// 底部来源行：只显示，不可点击（PRD 反馈：抓取内容的来源是提示性的，不应当作链接跳出）
    private func sourceLink(src: String) -> some View {
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

    private func relativeTime(iso: String) -> String {
        let fmts: [ISO8601DateFormatter.Options] = [
            [.withInternetDateTime, .withFractionalSeconds],
            [.withInternetDateTime],
        ]
        for opts in fmts {
            let f = ISO8601DateFormatter()
            f.formatOptions = opts
            if let d = f.date(from: iso) {
                let interval = -d.timeIntervalSinceNow
                if interval < 3600 { return "\(Int(interval / 60)) 分钟前" }
                if interval < 86400 { return "\(Int(interval / 3600)) 小时前" }
                let days = Int(interval / 86400)
                return "\(days) 天前"
            }
        }
        return iso
    }

    private func load() async {
        loading = true
        errorMessage = nil
        do {
            detail = try await IntelRepository.shared.getDetail(id: summary.id)
        } catch {
            errorMessage = error.localizedDescription
        }
        loading = false
    }
}
