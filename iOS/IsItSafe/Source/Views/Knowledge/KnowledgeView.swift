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
        NavigationStack {
            VStack(spacing: 0) {
                // 分类 + 搜索：紧贴导航标题，刷新在下方 List 上
                categoriesSearchHeader
                List {
                    contentBody
                }
                .listStyle(.plain)
                .listRowSeparator(.hidden)
                .scrollContentBackground(.hidden)
                .refreshable { vm.refresh() }
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
        }
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

    /// 列表主体内容，受当前加载状态影响
    private var contentBody: some View {
        Group {
            if case .loading = vm.state {
                ZStack {
                    AppTheme.background
                    ProgressView(languageCode == "en" ? "Loading..." : "加载中...")
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if case .failure(let e) = vm.state {
                ErrorStateView(message: (e as? APIError)?.userMessage ?? e.localizedDescription, retry: { vm.refresh() })
            } else if vm.items.isEmpty {
                VStack(spacing: 12) {
                    Spacer(minLength: 40)
                    Text(languageCode == "en" ? "No cases yet" : "暂无案例")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .frame(maxWidth: .infinity, alignment: .center)
                    Spacer(minLength: 40)
                }
            } else {
                ForEach(vm.items, id: \.id) { item in
                    Button {
                        selectedDetail = KnowledgeNavId(id: item.id)
                    } label: {
                        KnowledgeRow(item: item)
                    }
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
                    .onAppear { vm.loadMore() }
                }
            }
        }
    }
}
