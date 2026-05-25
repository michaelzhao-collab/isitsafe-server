//
//  SearchBar.swift
//  IsItSafe
//

import SwiftUI

public struct SearchBar: View {
    @Binding public var text: String
    public var placeholder: String
    public var onSearch: (() -> Void)?

    public init(text: Binding<String>, placeholder: String = "搜索", onSearch: (() -> Void)? = nil) {
        _text = text
        self.placeholder = placeholder
        self.onSearch = onSearch
    }

    public var body: some View {
        HStack {
            Image(systemName: "magnifyingglass")
                .foregroundColor(.secondary)
            TextField(placeholder, text: $text)
                .textFieldStyle(.plain)
                .onSubmit { onSearch?() }
            if !text.isEmpty {
                Button { text = "" } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(10)
        .background(AppTheme.cardBackground)
        .cornerRadius(10)
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(Color(UIColor.separator), lineWidth: 0.6)
        )
    }
}
