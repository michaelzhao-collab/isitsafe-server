//
//  LoginViewModel.swift
//  IsItSafe
//

import Combine
import Foundation

public final class LoginViewModel: ObservableObject {
    @Published public var selectedCountry: PhoneCountry = PhoneCountry.defaultForLocale()
    @Published public var nationalNumber = "" {
        didSet {
            let capped = String(nationalNumber.filter(\.isNumber).prefix(15))
            if capped != nationalNumber { nationalNumber = capped }
            phoneInputError = nil
        }
    }
    @Published public var email = ""
    @Published public var password = "" {
        didSet { passwordInputError = nil }
    }
    @Published public var isLoggingIn = false
    @Published public var errorMessage: String?
    @Published public var agreementAccepted = false
    @Published public var phoneInputError: String?
    @Published public var passwordInputError: String?

    private let auth = AuthService.shared
    private let appState = AppStateViewModel.shared
    private let authRepo = AuthRepository.shared

    private var localizedLoginAbnormalMessage: String {
        let en = (UserDefaults.standard.string(forKey: "isitsafe.language") ?? "zh") == "en"
        return en ? "Login abnormal" : "登录异常"
    }

    private func isBlockedLoginError(_ raw: String) -> Bool {
        let lower = raw.lowercased()
        return raw.contains("登录异常")
            || lower.contains("login abnormal")
            || lower.contains("account blocked")
            || lower.contains("blocked")
    }

    public var e164Phone: String {
        let digits = nationalNumber.filter(\.isNumber)
        let dial = selectedCountry.dialCode.replacingOccurrences(of: "+", with: "")
        return "+" + dial + digits
    }

    public var isPhoneNumberValid: Bool {
        PhoneCountry.isValidNationalNumber(iso: selectedCountry.id, digits: nationalNumber)
    }

    public var isPasswordValid: Bool { password.count >= 8 }

    public var canLoginWithPhone: Bool {
        agreementAccepted && isPhoneNumberValid && isPasswordValid
    }

    public var canAttemptLogin: Bool { agreementAccepted }

    private var localizedInvalidPhoneMessage: String {
        let en = (UserDefaults.standard.string(forKey: "isitsafe.language") ?? "zh") == "en"
        return en ? "Invalid phone number" : "手机号无效"
    }

    private var localizedInvalidPasswordMessage: String {
        let en = (UserDefaults.standard.string(forKey: "isitsafe.language") ?? "zh") == "en"
        return en ? "Password must be at least 8 characters" : "密码长度不能少于 8 位"
    }

    private var localizedWrongCredentialMessage: String {
        let en = (UserDefaults.standard.string(forKey: "isitsafe.language") ?? "zh") == "en"
        return en ? "Incorrect account or password" : "账号或密码不对"
    }

    public init() {}

    @MainActor
    public func refreshCountryHint() async {
        if let c = await pickCountryFromServer() { selectedCountry = c; return }
        if let c = await pickCountryFromIP() { selectedCountry = c }
    }

    private func pickCountryFromServer() async -> PhoneCountry? {
        do {
            let r = try await authRepo.regionHint()
            if let cc = r.countryCode, let c = PhoneCountry.find(iso: cc) { return c }
        } catch {}
        return nil
    }

    private func pickCountryFromIP() async -> PhoneCountry? {
        if let iso = await PhoneCountry.fetchIPCountryCode(), let c = PhoneCountry.find(iso: iso) { return c }
        return nil
    }

    public func loginWithPhone() {
        guard agreementAccepted else {
            let en = (UserDefaults.standard.string(forKey: "isitsafe.language") ?? "zh") == "en"
            errorMessage = en
                ? "Please read and agree to the Terms and Privacy Policy first"
                : "请先阅读并同意服务协议和隐私政策"
            return
        }
        guard isPhoneNumberValid else {
            phoneInputError = localizedInvalidPhoneMessage
            return
        }
        guard isPasswordValid else {
            passwordInputError = localizedInvalidPasswordMessage
            return
        }
        phoneInputError = nil
        passwordInputError = nil
        performLogin(phone: e164Phone, email: nil, password: password)
    }

    public func loginWithApple(identityToken: String, appleUser: String?, displayName: String?) {
        guard agreementAccepted else {
            let en = (UserDefaults.standard.string(forKey: "isitsafe.language") ?? "zh") == "en"
            errorMessage = en
                ? "Please read and agree to the Terms and Privacy Policy first"
                : "请先阅读并同意服务协议和隐私政策"
            return
        }
        isLoggingIn = true
        errorMessage = nil
        Task {
            do {
                try await auth.loginWithApple(identityToken: identityToken, appleUser: appleUser, displayName: displayName)
                await MainActor.run {
                    isLoggingIn = false
                    appState.markInitialLoginCompleted()
                    appState.refreshLoginState()
                    AppRouter.shared.dismissLogin()
                }
            } catch {
                await MainActor.run {
                    isLoggingIn = false
                    let raw = (error as? APIError)?.userMessage ?? error.localizedDescription
                    if isBlockedLoginError(raw) {
                        errorMessage = nil
                        AppStateViewModel.shared.showError(localizedLoginAbnormalMessage)
                    } else {
                        errorMessage = raw
                    }
                }
            }
        }
    }

    private func performLogin(phone: String?, email: String?, password: String?) {
        isLoggingIn = true
        errorMessage = nil
        Task {
            do {
                try await auth.login(phone: phone, email: email, password: password)
                await MainActor.run {
                    isLoggingIn = false
                    appState.markInitialLoginCompleted()
                    appState.refreshLoginState()
                    AppRouter.shared.dismissLogin()
                }
            } catch {
                await MainActor.run {
                    isLoggingIn = false
                    let raw = (error as? APIError)?.userMessage ?? error.localizedDescription
                    if isBlockedLoginError(raw) {
                        errorMessage = nil
                        AppStateViewModel.shared.showError(localizedLoginAbnormalMessage)
                        return
                    }
                    let lower = raw.lowercased()
                    if lower.contains("password") || lower.contains("密码") || lower.contains("incorrect") || lower.contains("错误") {
                        passwordInputError = localizedWrongCredentialMessage
                        errorMessage = nil
                    } else if lower.contains("phone") || lower.contains("手机") {
                        phoneInputError = localizedInvalidPhoneMessage
                        errorMessage = nil
                    } else {
                        errorMessage = raw
                    }
                }
            }
        }
    }
}
