//
//  IntelDetailView.swift
//  IsItSafe
//
//  V3-B 情报详情页（含 TipTap 结构化内容渲染 + 来源 + 时间）
//

import SwiftUI

public struct IntelDetailView: View {
    public let summary: IntelAlertSummary
    /// V4 复核扩展：举报成功 → 由 IntelListView 把这条 splice 掉；详情页随后自动 pop
    public let onReported: ((String) -> Void)?
    @Environment(\.dismiss) private var dismiss
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    @State private var detail: IntelAlertDetail?
    @State private var loading = true
    @State private var errorMessage: String?
    @State private var showReportSheet = false   // V4-P4 举报入口

    public init(summary: IntelAlertSummary, onReported: ((String) -> Void)? = nil) {
        self.summary = summary
        self.onReported = onReported
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // V3-K 顶部封面图：优先从详情拿，详情没回来就先用 summary 列表带的
                if let cover = (detail?.coverImage ?? summary.coverImage),
                   let url = URL(string: cover) {
                    heroImage(url: url)
                }
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
        .toolbar {
            // V4-P4 App Store 1.2 UGC 合规：内容详情需提供举报入口
            ToolbarItem(placement: .navigationBarTrailing) {
                Menu {
                    Button(role: .destructive) {
                        showReportSheet = true
                    } label: {
                        Label(languageCode == "en" ? "Report" : "举报", systemImage: "flag")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .sheet(isPresented: $showReportSheet) {
            IntelReportSheet(intelId: summary.id) {
                // 提交成功 → 通知列表移除 → 退出详情页
                onReported?(summary.id)
                dismiss()
            }
        }
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

    /// 底部来源行：只显示主域名，单行不可点击
    private func sourceLink(src: String) -> some View {
        HStack(spacing: 4) {
            Text(languageCode == "en" ? "Source:" : "来源：")
                .font(.caption2)
                .foregroundColor(AppTheme.textSecondary)
            Text(SourceHostFormatter.host(from: src))
                .font(.caption2)
                .foregroundColor(AppTheme.textSecondary)
                .lineLimit(1)
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
                return formatRelative(date: d, languageCode: languageCode)
            }
        }
        return iso
    }

    /// V3-K 详情页顶部 hero 图：固定 16:9 比例，加载失败不留白
    private func heroImage(url: URL) -> some View {
        AsyncImage(url: url) { phase in
            switch phase {
            case .success(let img):
                img.resizable()
                    .scaledToFill()
                    .frame(maxWidth: .infinity)
                    .frame(height: 200)
                    .clipped()
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            case .empty:
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color(.systemGray6))
                    .frame(height: 200)
                    .overlay(ProgressView())
            case .failure:
                EmptyView()
            @unknown default:
                EmptyView()
            }
        }
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
