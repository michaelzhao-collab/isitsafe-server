//
//  KnowledgeCategoryTabs.swift
//  IsItSafe
//

import SwiftUI

public struct KnowledgeCategoryTabs: View {
    @Binding public var selectedId: String?

    public var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(KnowledgeCategory.categories, id: \.id) { cat in
                    Button(cat.name) {
                        selectedId = cat.id.isEmpty ? nil : cat.id
                    }
                    .buttonStyle(.bordered)
                    .tint(selectedId == cat.id || (cat.id.isEmpty && selectedId == nil) ? .blue : .secondary)
                }
            }
            .padding(.horizontal)
        }
    }
}
