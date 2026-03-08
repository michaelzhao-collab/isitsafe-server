//
//  ToastView.swift
//  IsItSafe
//
//  居中显示，5 秒后自动消失。
//

import SwiftUI

public struct ToastView: View {
    public var message: String
    public var onDismiss: () -> Void

    public var body: some View {
        Text(message)
            .font(.subheadline)
            .foregroundColor(.white)
            .multilineTextAlignment(.center)
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
            .background(Color.black.opacity(0.8))
            .cornerRadius(8)
            .onTapGesture(perform: onDismiss)
            .onAppear {
                DispatchQueue.main.asyncAfter(deadline: .now() + 5) {
                    onDismiss()
                }
            }
    }
}
