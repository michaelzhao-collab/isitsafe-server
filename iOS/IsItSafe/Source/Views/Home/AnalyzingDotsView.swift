//
//  AnalyzingDotsView.swift
//  IsItSafe
//
//  「正在分析中......」6 个点循环动画，至少显示 3–5 秒。
//

import Combine
import SwiftUI

public struct AnalyzingDotsView: View {
    @State private var dotCount = 0
    private let totalDots = 6

    public init() {}

    public var body: some View {
        HStack(spacing: 4) {
            Text("正在分析中")
                .font(.subheadline)
                .foregroundColor(AppTheme.secondaryText)
            HStack(spacing: 2) {
                ForEach(0..<totalDots, id: \.self) { i in
                    Circle()
                        .fill(i <= dotCount ? AppTheme.primary : Color(white: 0.8))
                        .frame(width: 4, height: 4)
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(Color(white: 0.96))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .onReceive(Timer.publish(every: 0.4, on: .main, in: .common).autoconnect()) { _ in
            dotCount = (dotCount + 1) % (totalDots + 1)
        }
    }
}
