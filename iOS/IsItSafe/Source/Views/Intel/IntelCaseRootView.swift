//
//  IntelCaseRootView.swift
//  IsItSafe
//
//  V3-B "情报案例" Tab 主入口（替换原 Tab 1 KnowledgeView）
//
//  顶部 SegmentBar：
//   - [今日情报] / [案例库] segment 切换 + 右侧 ⚙ 偏好按钮（只在今日情报 segment 显示）
//   - 下划线设计，比默认 iOS UISegmentedControl 更现代
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
    @State private var showPreferences = false
    @StateObject private var tabBarVisibility = TabBarVisibility.shared
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"

    public init() {}

    public var body: some View {
        ZStack {
            AppTheme.background.ignoresSafeArea()
            VStack(spacing: 0) {
                // 详情页（.mainTabBarHidden）pushes TabBarVisibility → 同步隐藏 segment bar
                if !tabBarVisibility.isHidden {
                    segmentBar
                    Divider().opacity(0.4)
                }
                ZStack {
                    // 用 opacity 切换保持状态（避免每次重建子视图丢历史）
                    // V3-B 改：删 navigationTitle，segment bar 已经显示"今日情报"，
                    // 再加导航栏标题就重复了
                    NavigationStack {
                        IntelListView()
                            .navigationBarHidden(true)
                    }
                    .opacity(segment == .intel ? 1 : 0)
                    .allowsHitTesting(segment == .intel)

                    // 嵌入时隐藏 nav title，避免上方 segment 已有"案例库" tab 再叠一个"防诈案例"标题
                    // 用外层 NavigationStack 提供导航能力（KnowledgeView 内部已剥掉以消除"案例库"与分类条之间的空白）
                    NavigationStack {
                        KnowledgeView(showsTitle: false)
                            .navigationBarHidden(true)
                    }
                    .opacity(segment == .knowledge ? 1 : 0)
                    .allowsHitTesting(segment == .knowledge)
                }
            }
            // 底部 tabBar 占位（MainTabView 占了 88pt）
            .safeAreaInset(edge: .bottom, spacing: 0) { Color.clear.frame(height: 0) }
        }
        .sheet(isPresented: $showPreferences) {
            IntelPreferencesView()
        }
    }

    // MARK: - SegmentBar（下划线风格 + 右侧偏好按钮）

    private var segmentBar: some View {
        HStack(spacing: 0) {
            segmentButton(.intel, label: languageCode == "en" ? "Daily Intel" : "今日情报")
            segmentButton(.knowledge, label: languageCode == "en" ? "Case Library" : "案例库")
            Spacer()
            // 偏好按钮：只在"今日情报"segment 显示；切到"案例库"时隐藏
            if segment == .intel {
                Button {
                    showPreferences = true
                } label: {
                    Image(systemName: "slider.horizontal.3")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(AppTheme.textSecondary)
                        .frame(width: 36, height: 36)
                        .background(Color(.systemGray6))
                        .clipShape(Circle())
                }
                .transition(.opacity.combined(with: .scale))
                .padding(.trailing, 16)
            }
        }
        .padding(.top, 6)
        .padding(.bottom, 0)
    }

    private func segmentButton(_ s: Segment, label: String) -> some View {
        Button {
            withAnimation(.easeOut(duration: 0.18)) {
                segment = s
            }
        } label: {
            VStack(spacing: 5) {
                Text(label)
                    // 17pt 对齐系统 inline navigationTitle，选中加粗
                    .font(.system(size: 17, weight: segment == s ? .semibold : .regular))
                    .foregroundColor(segment == s ? AppTheme.textPrimary : AppTheme.textSecondary)
                // 下划线：选中态主色短线
                Rectangle()
                    .fill(segment == s ? AppTheme.primary : Color.clear)
                    .frame(height: 2)
                    .frame(maxWidth: 28)
                    .animation(.easeOut(duration: 0.18), value: segment)
            }
            .padding(.horizontal, 14)
            .padding(.top, 6)
        }
    }
}
