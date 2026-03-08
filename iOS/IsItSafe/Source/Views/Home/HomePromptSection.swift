//
//  HomePromptSection.swift
//  IsItSafe
//
//  首页提示词区块：标题「聊聊新话题」+ 竖向圆角浅灰按钮列表，参考图1样式。
//

import SwiftUI

public struct HomePromptSection: View {
    public var onSelect: (String) -> Void

    public init(onSelect: @escaping (String) -> Void) {
        self.onSelect = onSelect
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(PromptSuggestion.title)
                .font(.subheadline.weight(.medium))
                .foregroundColor(Color(white: 0.45))
                .frame(maxWidth: .infinity)

            VStack(alignment: .leading, spacing: 10) {
                ForEach(PromptSuggestion.items, id: \.self) { text in
                    Button {
                        onSelect(text)
                    } label: {
                        Text(text)
                            .font(.subheadline)
                            .foregroundColor(.primary)
                            .multilineTextAlignment(.leading)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 14)
                            .background(Color(white: 0.96))
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(.horizontal, 20)
    }
}
