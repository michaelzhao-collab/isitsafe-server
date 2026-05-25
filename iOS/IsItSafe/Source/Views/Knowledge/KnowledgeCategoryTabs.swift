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
                    Button(allLabel) {
                        selectedId = nil
                        withAnimation {
                            proxy.scrollTo("all", anchor: .center)
                        }
                    }
                    .id("all")
                    .buttonStyle(.bordered)
                    .tint(selectedId == nil ? .blue : .secondary)

                    ForEach(categories, id: \.id) { cat in
                        Button(cat.name) {
                            selectedId = cat.id
                            withAnimation {
                                proxy.scrollTo(cat.id, anchor: .center)
                            }
                        }
                        .id(cat.id)
                        .buttonStyle(.bordered)
                        .tint(selectedId == cat.id ? .blue : .secondary)
                    }
                }
                .padding(.horizontal)
            }
            .onChange(of: selectedId) { _, newValue in
                let target = (newValue ?? "").isEmpty ? "all" : newValue!
                withAnimation {
                    proxy.scrollTo(target, anchor: .center)
                }
            }
        }
    }
}
