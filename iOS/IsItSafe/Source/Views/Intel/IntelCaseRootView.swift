//
//  IntelCaseRootView.swift
//  IsItSafe
//
//  V3-B "情报案例" Tab 主入口（替换原 Tab 1 KnowledgeView）
//
//  顶部 Segment：[今日情报] / [案例库]
//   - 今日情报 → IntelListView（新）
//   - 案例库   → KnowledgeView（V2 现有，完全不动）
//
//  NavigationStack 嵌套规避：
//   - IntelListView 不带自己的 NavigationStack（详情 push 由外层负责）
//   - KnowledgeView 保留自带 NavigationStack（V2 行为）
//   - IntelCaseRootView 外层不再加 NavigationStack（避免嵌套）
//

import SwiftUI

public struct IntelCaseRootView: View {
    public enum Segment: Int, Hashable {
        case intel, knowledge
    }

    @State private var segment: Segment = .intel
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"

    public init() {}

    public var body: some View {
        ZStack {
            AppTheme.background.ignoresSafeArea()
            VStack(spacing: 0) {
                segmentBar
                ZStack {
                    // 用 opacity 切换保持状态（避免每次重建子视图丢历史）
                    NavigationStack {
                        IntelListView()
                            .navigationTitle(languageCode == "en" ? "Daily Intel" : "今日情报")
                            .navigationBarTitleDisplayMode(.inline)
                            .toolbarBackground(AppTheme.background, for: .navigationBar)
                    }
                    .opacity(segment == .intel ? 1 : 0)
                    .allowsHitTesting(segment == .intel)

                    // 嵌入时隐藏 nav title，避免上方 segment 已有"案例库" tab 再叠一个"防诈案例"标题
                    KnowledgeView(showsTitle: false)
                        .opacity(segment == .knowledge ? 1 : 0)
                        .allowsHitTesting(segment == .knowledge)
                }
            }
            // 底部 tabBar 占位（MainTabView 占了 88pt）
            .safeAreaInset(edge: .bottom, spacing: 0) { Color.clear.frame(height: 0) }
        }
    }

    private var segmentBar: some View {
        HStack(spacing: 0) {
            segmentButton(.intel, label: languageCode == "en" ? "Daily Intel" : "今日情报")
            segmentButton(.knowledge, label: languageCode == "en" ? "Case Library" : "案例库")
        }
        .padding(4)
        .background(Color(.systemGray6))
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .padding(.bottom, 4)
    }

    private func segmentButton(_ s: Segment, label: String) -> some View {
        Button {
            withAnimation(.easeOut(duration: 0.15)) {
                segment = s
            }
        } label: {
            Text(label)
                .font(.subheadline.weight(segment == s ? .semibold : .regular))
                .foregroundColor(segment == s ? AppTheme.textPrimary : AppTheme.textSecondary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .background(
                    Group {
                        if segment == s {
                            RoundedRectangle(cornerRadius: 8)
                                .fill(AppTheme.cardBackground)
                                .shadow(color: .black.opacity(0.06), radius: 2, x: 0, y: 1)
                        } else {
                            Color.clear
                        }
                    }
                )
        }
    }
}
