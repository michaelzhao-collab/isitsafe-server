//
//  ArticleRendererView.swift
//  IsItSafe
//
//  把 [ArticleBlock] 渲染成 SwiftUI 原生视图，支持 heading / paragraph / image / list / quote / code / divider。
//  图片走 AsyncImage 从 R2 CDN 加载，加载中显示骨架占位，加载失败显示替代图标。
//

import SwiftUI

public struct ArticleRendererView: View {
    public let blocks: [ArticleBlock]
    public init(blocks: [ArticleBlock]) { self.blocks = blocks }

    public var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            ForEach(blocks) { block in
                blockView(block)
            }
        }
    }

    /// 用 AnyView 打破 some View 自递归（list/blockquote 内部会再次调用 blockView）
    private func blockView(_ block: ArticleBlock) -> AnyView {
        switch block {
        case .heading(let level, let spans):
            return AnyView(
                inlineText(spans)
                    .font(headingFont(level: level))
                    .foregroundColor(AppTheme.textPrimary)
                    .padding(.top, 6)
            )
        case .paragraph(let spans):
            return AnyView(
                inlineText(spans)
                    .font(.body)
                    .foregroundColor(.primary)
                    .lineSpacing(4)
                    .fixedSize(horizontal: false, vertical: true)
            )
        case .image(let src, let alt, let caption):
            return AnyView(articleImage(src: src, alt: alt, caption: caption))
        case .bulletList(let items):
            return AnyView(
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                        HStack(alignment: .top, spacing: 8) {
                            Text("•").font(.body).foregroundColor(.secondary)
                            VStack(alignment: .leading, spacing: 6) {
                                ForEach(item) { sub in blockView(sub) }
                            }
                        }
                    }
                }
            )
        case .orderedList(let items):
            return AnyView(
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(Array(items.enumerated()), id: \.offset) { idx, item in
                        HStack(alignment: .top, spacing: 8) {
                            Text("\(idx + 1).").font(.body.weight(.medium)).foregroundColor(.secondary)
                            VStack(alignment: .leading, spacing: 6) {
                                ForEach(item) { sub in blockView(sub) }
                            }
                        }
                    }
                }
            )
        case .blockquote(let subBlocks):
            return AnyView(
                HStack(spacing: 12) {
                    Rectangle().fill(Color.accentColor.opacity(0.5)).frame(width: 3)
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(subBlocks) { sub in blockView(sub) }
                    }
                }
                .padding(.vertical, 4)
            )
        case .codeBlock(let code, _):
            return AnyView(
                ScrollView(.horizontal, showsIndicators: false) {
                    Text(code)
                        .font(.system(.callout, design: .monospaced))
                        .padding(12)
                }
                .background(Color(.secondarySystemBackground))
                .cornerRadius(8)
            )
        case .divider:
            return AnyView(Divider().padding(.vertical, 4))
        }
    }

    /// 把 [InlineSpan] 合并成一段 AttributedString，统一交给 SwiftUI Text 渲染
    private func inlineText(_ spans: [InlineSpan]) -> Text {
        spans.map { span -> Text in
            var t = Text(span.text)
            if span.bold { t = t.bold() }
            if span.italic { t = t.italic() }
            if span.strike { t = t.strikethrough() }
            if span.code {
                t = t.font(.system(.body, design: .monospaced))
            }
            if span.link != nil {
                t = t.foregroundColor(.accentColor).underline()
            }
            return t
        }.reduce(Text("")) { $0 + $1 }
    }

    private func headingFont(level: Int) -> Font {
        switch level {
        case 1: return .system(size: 24, weight: .bold)
        case 2: return .system(size: 20, weight: .bold)
        default: return .system(size: 18, weight: .semibold)
        }
    }

    @ViewBuilder
    private func articleImage(src: String, alt: String?, caption: String?) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            if let url = URL(string: src) {
                AsyncImage(url: url, transaction: Transaction(animation: .easeInOut(duration: 0.2))) { phase in
                    switch phase {
                    case .success(let img):
                        img.resizable().scaledToFit().cornerRadius(8)
                    case .failure:
                        ZStack {
                            Color(.secondarySystemBackground)
                            Image(systemName: "photo")
                                .foregroundColor(.secondary)
                        }
                        .frame(height: 160)
                        .cornerRadius(8)
                    case .empty:
                        ZStack {
                            Color(.secondarySystemBackground)
                            ProgressView()
                        }
                        .frame(height: 160)
                        .cornerRadius(8)
                    @unknown default:
                        EmptyView()
                    }
                }
            } else {
                Color.gray.opacity(0.1).frame(height: 100).cornerRadius(8)
            }
            if let cap = caption ?? alt, !cap.isEmpty {
                Text(cap)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
    }
}
