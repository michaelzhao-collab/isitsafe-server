//
//  ThemeButton.swift
//  IsItSafe
//
//  统一 CTA 按钮：主色背景 + 白字 + loading/disabled 状态。
//  替代 PrimaryButton（Color.accentColor）与各处自定义按钮，保证颜色/圆角/字号一致。
//

import SwiftUI

public enum ThemeButtonStyle {
    /// 主按钮：实心、主色背景、白字
    case primary
    /// 次按钮：描边、主色字、透明背景
    case secondary
    /// 危险操作：实心红色
    case destructive
}

public struct ThemeButton: View {
    public let title: String
    public let style: ThemeButtonStyle
    public let isLoading: Bool
    public let isFullWidth: Bool
    public let action: () -> Void

    public init(
        _ title: String,
        style: ThemeButtonStyle = .primary,
        isLoading: Bool = false,
        isFullWidth: Bool = true,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.style = style
        self.isLoading = isLoading
        self.isFullWidth = isFullWidth
        self.action = action
    }

    public var body: some View {
        Button(action: {
            guard !isLoading else { return }
            action()
        }) {
            HStack(spacing: 6) {
                if isLoading {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .tint(foregroundColor)
                        .scaleEffect(0.85)
                }
                Text(title)
                    .font(.headline)
            }
            .frame(maxWidth: isFullWidth ? .infinity : nil)
            .padding(.horizontal, 18)
            .padding(.vertical, 14)
            .background(backgroundColor)
            .foregroundColor(foregroundColor)
            .overlay(
                RoundedRectangle(cornerRadius: AppTheme.CornerRadius.medium, style: .continuous)
                    .stroke(borderColor, lineWidth: borderWidth)
            )
            .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.medium, style: .continuous))
            .opacity(isLoading ? 0.7 : 1)
        }
        .buttonStyle(.plain)
        .disabled(isLoading)
        .accessibilityHint(isLoading ? Text("加载中") : Text(""))
    }

    private var backgroundColor: Color {
        switch style {
        case .primary: return AppTheme.primary
        case .secondary: return .clear
        case .destructive: return AppTheme.riskHigh
        }
    }

    private var foregroundColor: Color {
        switch style {
        case .primary, .destructive: return .white
        case .secondary: return AppTheme.primary
        }
    }

    private var borderColor: Color {
        switch style {
        case .primary, .destructive: return .clear
        case .secondary: return AppTheme.primary
        }
    }

    private var borderWidth: CGFloat {
        switch style {
        case .secondary: return 1.5
        default: return 0
        }
    }
}
