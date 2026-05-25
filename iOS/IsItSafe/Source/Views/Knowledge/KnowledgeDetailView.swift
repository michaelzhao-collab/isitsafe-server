//
//  KnowledgeDetailView.swift
//  IsItSafe
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
                    ProgressView("加载中...")
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if case .failure = vm.state, vm.item == nil {
                ErrorStateView(message: "加载失败", retry: { vm.load(id: id) })
            } else if let item = vm.item {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
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
                            .cornerRadius(8)
                        }

                        // 文章正文：优先用结构化 blocks 渲染，否则降级显示纯文本 content
                        let blocks = ArticleBlockParser.parse(item.contentBlocks)
                        if !blocks.isEmpty {
                            ArticleRendererView(blocks: blocks)
                        } else {
                            Text(item.content)
                                .font(.body)
                                .lineSpacing(4)
                                .fixedSize(horizontal: false, vertical: true)
                        }

                        if !item.tags.isEmpty {
                            Text((languageCode == "en" ? "Tags: " : "标签：") + item.tags.joined(separator: "、"))
                                .font(.caption)
                                .foregroundColor(.secondary)
                                .padding(.top, 8)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
                    .padding(.bottom, 32)
                }
            }
        }
        .background(AppTheme.background)
        .navigationTitle(vm.item?.title ?? (languageCode == "en" ? "Case detail" : "案例详情"))
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { vm.load(id: id) }
    }
}
