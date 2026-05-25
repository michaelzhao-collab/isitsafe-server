//
//  HomePromptSection.swift
//  IsItSafe
//
//  首页提示词区块：标题「聊聊新话题」+ 竖向圆角浅灰按钮列表，参考图1样式。
//

import SwiftUI

public struct HomePromptSection: View {
    public var onSelect: (String) -> Void
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"

    public init(onSelect: @escaping (String) -> Void) {
        self.onSelect = onSelect
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(PromptSuggestion.title(languageCode: languageCode))
                .font(.subheadline.weight(.medium))
                .foregroundColor(AppTheme.textSecondary)
                .frame(maxWidth: .infinity)

            VStack(alignment: .leading, spacing: 10) {
                ForEach(PromptSuggestion.items(languageCode: languageCode), id: \.self) { text in
                    Button {
                        onSelect(text)
                    } label: {
                        Text(text)
                            .font(.subheadline)
                            .foregroundColor(AppTheme.textPrimary)
                            .multilineTextAlignment(.leading)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 14)
                            .background(AppTheme.cardBackground)
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(.horizontal, 20)
    }
}
