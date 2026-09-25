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
    @Published public var email = "" {
        didSet { emailInputError = nil }
    }
    @Published public var password = "" {
        didSet { passwordInputError = nil }
    }
    @Published public var isLoggingIn = false
    @Published public var errorMessage: String?
    @Published public var agreementAccepted = false
    @Published public var phoneInputError: String?
    @Published public var passwordInputError: String?

    // MARK: - 邮箱 + 验证码登录（与手机号+密码登录并列，不替换）

    /// 只保留数字、最多 6 位；输入即清掉上一次的错误提示
    @Published public var emailCode = "" {
        didSet {
            let capped = String(emailCode.filter(\.isNumber).prefix(6))
            if capped != emailCode { emailCode = capped }
            codeInputError = nil
        }
    }
    @Published public var emailInputError: String?
    @Published public var codeInputError: String?
    @Published public var isSendingCode = false
    /// 重新发送倒计时（秒），> 0 时「获取验证码」按钮禁用
    @Published public var resendCountdown = 0
    /// 发送成功后的提示（"验证码已发送到…"）
    @Published public var codeSentHint: String?

    private var resendTimer: Timer?

    deinit { resendTimer?.invalidate() }

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

    // MARK: - 邮箱登录的派生状态

    /// 服务端要求小写；本地也统一小写 + 去空格，避免大小写不同被当成两个账号
    public var normalizedEmail: String {
        email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    /// 轻量格式校验：只挡明显不对的输入，真正的合法性由服务端判定
    public var isEmailValid: Bool {
        let e = normalizedEmail
        guard e.count >= 6, e.count <= 254, !e.contains(" ") else { return false }
        let parts = e.split(separator: "@", omittingEmptySubsequences: false)
        guard parts.count == 2 else { return false }
        let local = parts[0]
        let domain = parts[1]
        guard !local.isEmpty, !domain.isEmpty else { return false }
        guard domain.contains("."), !domain.hasPrefix("."), !domain.hasSuffix(".") else { return false }
        return true
    }

    public var isEmailCodeValid: Bool { emailCode.count == 6 }

    public var canSendEmailCode: Bool {
        agreementAccepted && isEmailValid && !isSendingCode && resendCountdown == 0
    }

    public var canLoginWithEmailCode: Bool {
        agreementAccepted && isEmailValid && isEmailCodeValid && !isLoggingIn
    }

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

    private var isEnglish: Bool {
        (UserDefaults.standard.string(forKey: "isitsafe.language") ?? "zh") == "en"
    }

    private var localizedAgreementRequiredMessage: String {
        isEnglish
            ? "Please read and agree to the Terms and Privacy Policy first"
            : "请先阅读并同意服务协议和隐私政策"
    }

    private var localizedInvalidEmailMessage: String {
        isEnglish ? "Please enter a valid email address" : "请输入正确的邮箱地址"
    }

    private var localizedInvalidCodeMessage: String {
        isEnglish ? "Enter the 6-digit code" : "请输入 6 位验证码"
    }

    private var localizedCodeSentMessage: String {
        isEnglish
            ? "Code sent. Check your inbox (and spam folder)."
            : "验证码已发送，请查收邮件（也看一下垃圾邮件）"
    }

    private var localizedTooFrequentMessage: String {
        isEnglish ? "Too many requests. Please try again later." : "发送太频繁，请稍后再试"
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

    // MARK: - 邮箱 + 验证码

    /// 发送验证码。客户端先做基本格式校验，避免把明显错的邮箱打到服务端浪费额度。
    public func sendEmailCode() {
        guard agreementAccepted else {
            errorMessage = localizedAgreementRequiredMessage
            return
        }
        guard isEmailValid else {
            emailInputError = localizedInvalidEmailMessage
            return
        }
        guard resendCountdown == 0, !isSendingCode else { return }
        emailInputError = nil
        codeSentHint = nil
        errorMessage = nil
        isSendingCode = true
        let target = normalizedEmail
        Task { [weak self] in
            guard let self else { return }
            do {
                let res = try await self.auth.sendEmailCode(email: target)
                await MainActor.run {
                    self.isSendingCode = false
                    self.codeSentHint = self.localizedCodeSentMessage
                    self.startResendCountdown(res.cooldown)
                }
            } catch let limited as EmailCodeRateLimited {
                // 429：用服务端给的秒数启动倒计时，避免用户反复点
                await MainActor.run {
                    self.isSendingCode = false
                    self.errorMessage = limited.message ?? self.localizedTooFrequentMessage
                    self.startResendCountdown(limited.retryAfterSeconds)
                }
            } catch {
                await MainActor.run {
                    self.isSendingCode = false
                    let raw = (error as? APIError)?.userMessage ?? error.localizedDescription
                    if self.isBlockedLoginError(raw) {
                        self.errorMessage = nil
                        AppStateViewModel.shared.showError(self.localizedLoginAbnormalMessage)
                    } else {
                        self.errorMessage = raw
                    }
                }
            }
        }
    }

    public func loginWithEmailCode() {
        guard agreementAccepted else {
            errorMessage = localizedAgreementRequiredMessage
            return
        }
        guard isEmailValid else {
            emailInputError = localizedInvalidEmailMessage
            return
        }
        guard isEmailCodeValid else {
            codeInputError = localizedInvalidCodeMessage
            return
        }
        emailInputError = nil
        codeInputError = nil
        errorMessage = nil
        isLoggingIn = true
        let target = normalizedEmail
        let code = emailCode
        Task { [weak self] in
            guard let self else { return }
            do {
                try await self.auth.loginWithEmailCode(email: target, code: code)
                await MainActor.run {
                    self.isLoggingIn = false
                    self.stopResendCountdown()
                    self.emailCode = ""
                    self.codeSentHint = nil
                    self.appState.markInitialLoginCompleted()
                    self.appState.refreshLoginState()
                    AppRouter.shared.dismissLogin()
                }
            } catch {
                await MainActor.run {
                    self.isLoggingIn = false
                    let raw = (error as? APIError)?.userMessage ?? error.localizedDescription
                    if self.isBlockedLoginError(raw) {
                        self.errorMessage = nil
                        AppStateViewModel.shared.showError(self.localizedLoginAbnormalMessage)
                        return
                    }
                    // 验证码类错误就近显示在验证码框下，其余走顶部通用错误
                    let lower = raw.lowercased()
                    if raw.contains("验证码") || lower.contains("code") || raw.contains("过期") || lower.contains("expired") {
                        self.codeInputError = raw
                        self.errorMessage = nil
                    } else if raw.contains("邮箱") || lower.contains("email") {
                        self.emailInputError = raw
                        self.errorMessage = nil
                    } else {
                        self.errorMessage = raw
                    }
                }
            }
        }
    }

    /// 倒计时跑在主 run loop 上；重复调用会先作废上一个 timer，登录成功时统一 stop，避免泄漏
    @MainActor
    private func startResendCountdown(_ seconds: Int) {
        resendTimer?.invalidate()
        resendTimer = nil
        resendCountdown = max(0, seconds)
        guard resendCountdown > 0 else { return }
        let timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] t in
            Task { @MainActor in
                guard let self else { t.invalidate(); return }
                if self.resendCountdown > 0 { self.resendCountdown -= 1 }
                if self.resendCountdown == 0 {
                    t.invalidate()
                    self.resendTimer = nil
                }
            }
        }
        resendTimer = timer
    }

    @MainActor
    public func stopResendCountdown() {
        resendTimer?.invalidate()
        resendTimer = nil
        resendCountdown = 0
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
