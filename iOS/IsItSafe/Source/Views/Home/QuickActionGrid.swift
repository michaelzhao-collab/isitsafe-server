//
//  QuickActionGrid.swift
//  IsItSafe
//

import SwiftUI

public struct QuickActionGrid: View {
    public var onPhone: () -> Void
    public var onURL: () -> Void
    public var onCompany: () -> Void

    public var body: some View {
        HStack(spacing: 12) {
            Button("查电话", action: onPhone)
                .buttonStyle(QuickActionButtonStyle())
            Button("查链接", action: onURL)
                .buttonStyle(QuickActionButtonStyle())
            Button("查公司", action: onCompany)
                .buttonStyle(QuickActionButtonStyle())
        }
    }
}

private struct QuickActionButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.medium))
            .foregroundColor(AppTheme.primary)
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(AppTheme.cardBackground)
            .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).stroke(Color(white: 0.9), lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
}
