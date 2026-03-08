//
//  LoginViewModel.swift
//  IsItSafe
//

import Combine
import Foundation
import SwiftUI

public final class LoginViewModel: ObservableObject {
    @Published public var phone = ""
    @Published public var email = ""
    @Published public var code = ""
    @Published public var smsCode = ""
    @Published public var isLoggingIn = false
    @Published public var errorMessage: String?
    @Published public var agreementAccepted = false

    private let auth = AuthService.shared
    private let appState = AppStateViewModel.shared

    public var canLoginWithPhone: Bool { agreementAccepted && phone.count >= 11 && (code.count >= 4 || smsCode.count >= 4) }
    public var canLoginWithEmail: Bool { agreementAccepted && email.contains("@") && code.count >= 4 }

    public var canAttemptLogin: Bool { agreementAccepted }

    public func loginWithPhone() {
        guard agreementAccepted else {
            errorMessage = "请先阅读并同意服务协议和隐私政策"
            return
        }
        guard canLoginWithPhone else {
            errorMessage = "请输入手机号和验证码"
            return
        }
        performLogin(phone: phone, email: nil, code: code.isEmpty ? nil : code, smsCode: smsCode.isEmpty ? nil : smsCode)
    }

    public func loginWithEmail() {
        guard agreementAccepted else {
            errorMessage = "请先阅读并同意服务协议和隐私政策"
            return
        }
        guard canLoginWithEmail else {
            errorMessage = "请输入邮箱和验证码"
            return
        }
        performLogin(phone: nil, email: email, code: code, smsCode: nil)
    }

    private func performLogin(phone: String?, email: String?, code: String?, smsCode: String?) {
        isLoggingIn = true
        errorMessage = nil
        Task {
            do {
                try await auth.login(phone: phone, email: email, code: code, smsCode: smsCode)
                await MainActor.run {
                    isLoggingIn = false
                    appState.refreshLoginState()
                    AppRouter.shared.dismissLogin()
                }
            } catch {
                await MainActor.run {
                    isLoggingIn = false
                    errorMessage = (error as? APIError)?.userMessage ?? error.localizedDescription
                }
            }
        }
    }

    /// 游客入口：进入 App 使用模拟数据，无需登录
    public func enterGuestMode() {
        MockData.isMockModeEnabled = true
        TokenStore.shared.saveToken(access: "mock_access_token", refresh: "mock_refresh_token")
        UserSessionStore.shared.updateUser(MockData.fakeUser)
        appState.refreshLoginState()
        appState.setSubscriptionActive(true)
        appState.isGuestMode = true
        AppRouter.shared.dismissLogin()
    }
}
