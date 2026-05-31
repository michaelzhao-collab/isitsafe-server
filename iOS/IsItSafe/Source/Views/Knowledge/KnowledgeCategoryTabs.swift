//
//  KnowledgeCategoryTabs.swift
//  IsItSafe
//

import SwiftUI

public struct KnowledgeCategoryTabs: View {
    @Binding public var selectedId: String?
    public var categories: [KnowledgeCategoryItem]
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"

    public init(selectedId: Binding<String?>, categories: [KnowledgeCategoryItem]) {
        self._selectedId = selectedId
        self.categories = categories
    }

    private var allLabel: String {
        languageCode == "en" ? "All" : "全部"
    }

    public var body: some View {
        ScrollViewReader { proxy in
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    chip(label: allLabel, isSelected: selectedId == nil) {
                        selectedId = nil
                        withAnimation { proxy.scrollTo("all", anchor: .center) }
                    }
                    .id("all")

                    ForEach(categories, id: \.id) { cat in
                        chip(label: cat.name, isSelected: selectedId == cat.id) {
                            selectedId = cat.id
                            withAnimation { proxy.scrollTo(cat.id, anchor: .center) }
                        }
                        .id(cat.id)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 4)
            }
            .onChange(of: selectedId) { _, newValue in
                let target = (newValue ?? "").isEmpty ? "all" : newValue!
                withAnimation {
                    proxy.scrollTo(target, anchor: .center)
                }
            }
        }
    }

    /// 紫蓝主色填充选中态 + 浅灰胶囊未选中态；切换带柔和缩放
    @ViewBuilder
    private func chip(label: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.subheadline.weight(isSelected ? .semibold : .regular))
                .foregroundColor(isSelected ? .white : AppTheme.textSecondary)
                .padding(.horizontal, 14)
                .padding(.vertical, 7)
                .background(
                    Group {
                        if isSelected {
                            Capsule().fill(AppTheme.primary)
                        } else {
                            Capsule().fill(AppTheme.cardBackground)
                                .overlay(Capsule().stroke(AppTheme.border, lineWidth: 1))
                        }
                    }
                )
                .shadow(color: isSelected ? AppTheme.primary.opacity(0.25) : .clear, radius: 6, x: 0, y: 2)
                .scaleEffect(isSelected ? 1.02 : 1.0)
                .animation(.spring(response: 0.28, dampingFraction: 0.85), value: isSelected)
        }
        .buttonStyle(.plain)
    }
}
