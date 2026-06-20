//
//  CenterConfirmDialog.swift
//  IsItSafe
//
//  V4 业主诉求：解散家庭 / 退出家庭这种"危险操作"二次确认要居中显示，
//  系统底部 .confirmationDialog 看起来像普通菜单不够慎重。
//
//  通用居中确认弹框：半透明遮罩 + 圆角白卡 + 标题 + 描述 + 取消 / 危险动作 双按钮。
//  用 .modifier(CenterConfirmDialog(...)) 挂载到任意 View。
//

import SwiftUI

public struct CenterConfirmDialog: ViewModifier {
    @Binding public var isPresented: Bool
    public let title: String
    public let message: String?
    public let confirmText: String
    public let cancelText: String
    public let confirmRole: Role
    public let onConfirm: () -> Void

    public enum Role {
        case destructive
        case primary
    }

    public init(
        isPresented: Binding<Bool>,
        title: String,
        message: String? = nil,
        confirmText: String,
        cancelText: String,
        confirmRole: Role = .destructive,
        onConfirm: @escaping () -> Void
    ) {
        self._isPresented = isPresented
        self.title = title
        self.message = message
        self.confirmText = confirmText
        self.cancelText = cancelText
        self.confirmRole = confirmRole
        self.onConfirm = onConfirm
    }

    public func body(content: Content) -> some View {
        content.overlay {
            if isPresented {
                ZStack {
                    Color.black.opacity(0.45)
                        .ignoresSafeArea()
                        .transition(.opacity)
                        .onTapGesture { withAnimation(.easeOut(duration: 0.18)) { isPresented = false } }

                    card
                        .transition(.scale(scale: 0.92).combined(with: .opacity))
                }
                .animation(.easeOut(duration: 0.18), value: isPresented)
                .zIndex(1000)
            }
        }
    }

    private var card: some View {
        VStack(spacing: 16) {
            Text(title)
                .font(.system(size: 17, weight: .semibold))
                .foregroundColor(AppTheme.textPrimary)
                .multilineTextAlignment(.center)

            if let msg = message, !msg.isEmpty {
                Text(msg)
                    .font(.system(size: 14))
                    .foregroundColor(AppTheme.textSecondary)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }

            HStack(spacing: 12) {
                Button {
                    withAnimation(.easeOut(duration: 0.18)) { isPresented = false }
                } label: {
                    Text(cancelText)
                        .font(.system(size: 15, weight: .medium))
                        .foregroundColor(AppTheme.textPrimary)
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                        .background(Color(.systemGray6))
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                .buttonStyle(.plain)

                Button {
                    withAnimation(.easeOut(duration: 0.18)) { isPresented = false }
                    // 等遮罩 fade 完再触发回调，避免 alert 内容与下一个 sheet 撞动画
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.18) {
                        onConfirm()
                    }
                } label: {
                    Text(confirmText)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                        .background(confirmRole == .destructive ? AppTheme.riskHigh : AppTheme.primary)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                .buttonStyle(.plain)
            }
            .padding(.top, 4)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 22)
        .frame(maxWidth: 320)
        .background(AppTheme.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .shadow(color: Color.black.opacity(0.18), radius: 20, x: 0, y: 8)
        .padding(.horizontal, 36)
    }
}

public extension View {
    /// 居中确认弹框 — 替代系统 .confirmationDialog 用于"危险操作"二次确认
    func centerConfirmDialog(
        isPresented: Binding<Bool>,
        title: String,
        message: String? = nil,
        confirmText: String,
        cancelText: String,
        confirmRole: CenterConfirmDialog.Role = .destructive,
        onConfirm: @escaping () -> Void
    ) -> some View {
        modifier(
            CenterConfirmDialog(
                isPresented: isPresented,
                title: title,
                message: message,
                confirmText: confirmText,
                cancelText: cancelText,
                confirmRole: confirmRole,
                onConfirm: onConfirm
            )
        )
    }
}
