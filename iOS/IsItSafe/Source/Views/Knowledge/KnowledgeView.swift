//
//  KnowledgeView.swift
//  IsItSafe
//

import SwiftUI

private struct KnowledgeNavId: Identifiable, Hashable { let id: String }

public struct KnowledgeView: View {
    @StateObject private var vm = KnowledgeViewModel()
    @State private var selectedDetail: KnowledgeNavId?
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    /// 嵌入到 IntelCaseRootView 的 segment 内时设为 false：隐藏 navigationTitle，避免与上层 segment 标题重复
    private let showsTitle: Bool

    public init(showsTitle: Bool = true) {
        self.showsTitle = showsTitle
    }

    public var body: some View {
        // 嵌入到 IntelCaseRootView 时，外层已提供 NavigationStack，
        // 这里再套一层会预留隐藏的 nav bar 空间，造成"案例库" segment 与分类条之间的空白
        // 独立打开时（showsTitle=true）仍包一层 NavigationStack 提供 title+nav
        Group {
            if showsTitle {
                NavigationStack { contentRoot }
            } else {
                contentRoot
            }
        }
    }

    private var contentRoot: some View {
        VStack(spacing: 0) {
            // 分类 + 搜索：紧贴导航标题，刷新在下方 List 上
            categoriesSearchHeader
            // F9：loading / error / empty 状态从 List 中抽出来，避免被 List 默认行背景包成白卡
            if case .loading = vm.state {
                loadingStateBare
            } else if case .failure(let e) = vm.state {
                ErrorStateView(message: (e as? APIError)?.userMessage ?? e.localizedDescription, retry: { vm.refresh() })
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(AppTheme.background)
            } else if vm.items.isEmpty {
                emptyStateBare
            } else {
                List {
                    contentBody
                }
                .listStyle(.plain)
                .listRowSeparator(.hidden)
                .scrollContentBackground(.hidden)
                .refreshable { vm.refresh() }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AppTheme.background)
        .navigationTitle(showsTitle ? L10n.titleCases : "")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(showsTitle ? .visible : .hidden, for: .navigationBar)
        .toolbarBackground(AppTheme.background, for: .navigationBar)
        .navigationDestination(item: $selectedDetail) { nav in
            KnowledgeDetailView(id: nav.id)
                .mainTabBarHidden()
        }
        .safeAreaInset(edge: .bottom, spacing: 0) { Color.clear.frame(height: 88) }
        .onAppear { vm.loadFirstPage() }
        .onChange(of: vm.selectedCategory) { _, _ in vm.loadFirstPage() }
    }

    /// 分类与搜索栏，紧贴标题；刷新在下方 List，下拉时出现在分类下方。
    private var categoriesSearchHeader: some View {
        VStack(spacing: 8) {
            KnowledgeCategoryTabs(selectedId: $vm.selectedCategory, categories: vm.categories)
            SearchBar(text: $vm.searchText, placeholder: languageCode == "en" ? "Search cases" : "搜索案例") {
                vm.applySearch()
            }
            .padding(.horizontal)
            .padding(.bottom, 8)
        }
        .padding(.top, 4)
        .frame(maxWidth: .infinity)
        .background(AppTheme.background)
    }

    /// F9 极简 loading：无背景框 + 小菊花 + 灰色辅助文字
    private var loadingStateBare: some View {
        VStack(spacing: 10) {
            Spacer(minLength: 80)
            ProgressView()
                .tint(AppTheme.textSecondary)
            Text(languageCode == "en" ? "Loading..." : "加载中…")
                .font(.footnote)
                .foregroundColor(AppTheme.textSecondary)
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AppTheme.background)
    }

    private var emptyStateBare: some View {
        VStack(spacing: 12) {
            Spacer(minLength: 80)
            Text(languageCode == "en" ? "No cases yet" : "暂无案例")
                .font(.subheadline)
                .foregroundColor(AppTheme.textSecondary)
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AppTheme.background)
    }

    /// 列表主体（仅 items 不为空时调用，loading/error/empty 已抽到 body 顶层）
    @ViewBuilder
    private var contentBody: some View {
        ForEach(vm.items, id: \.id) { item in
            Button {
                selectedDetail = KnowledgeNavId(id: item.id)
            } label: {
                KnowledgeRow(item: item)
            }
            .buttonStyle(.plain)
            // P0-5：卡片化样式适配 — 透明背景 + 行间距 + 隐藏分隔线
            .listRowSeparator(.hidden)
            .listRowBackground(Color.clear)
            .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
            .onAppear {
                if item.id == vm.items.last?.id { vm.loadMore() }
            }
        }
        if vm.hasMore {
            HStack {
                Spacer()
                if vm.isLoadingMore {
                    ProgressView()
                        .padding()
                } else {
                    Text(languageCode == "en" ? "Pull up to load more" : "上拉加载更多")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .padding()
                }
                Spacer()
            }
            .listRowSeparator(.hidden)
            .listRowBackground(Color.clear)
            .onAppear { vm.loadMore() }
        }
    }
}
