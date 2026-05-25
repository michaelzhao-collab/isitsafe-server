//
//  ToastView.swift
//  IsItSafe
//
//  居中显示，5 秒后自动消失。
//

import SwiftUI
import UIKit

public struct ToastView: View {
    public var message: String
    public var isSuccess: Bool
    public var onDismiss: () -> Void

    public init(message: String, isSuccess: Bool = false, onDismiss: @escaping () -> Void) {
        self.message = message
        self.isSuccess = isSuccess
        self.onDismiss = onDismiss
    }

    public var body: some View {
        Text(message)
            .font(.subheadline)
            .foregroundColor(.white)
            .multilineTextAlignment(.center)
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
            .background((isSuccess ? Color(UIColor.systemGray) : Color.black).opacity(0.85))
            .cornerRadius(8)
            .onTapGesture(perform: onDismiss)
            .onAppear {
                DispatchQueue.main.asyncAfter(deadline: .now() + 5) {
                    onDismiss()
                }
            }
    }
}
