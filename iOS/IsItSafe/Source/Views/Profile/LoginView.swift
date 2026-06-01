//
//  LoginView.swift
//  IsItSafe
//
//  登录页：样式参考设计图2。默认微信登录，支持手机号+验证码、苹果快捷登录；须同意协议方可登录；提供游客入口。
//

import SwiftUI
import AuthenticationServices

private enum AgreementWebSheet: Identifiable {
    case terms
    case privacy
    var id: Self { self }
}

public struct LoginView: View {
    @StateObject private var vm = LoginViewModel()
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppStateViewModel
    @EnvironmentObject private var router: AppRouter
    @State private var showPhoneLogin = false
    @State private var showCountryPicker = false
    @State private var agreementWebSheet: AgreementWebSheet?
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    @FocusState private var phoneFieldFocused: Bool
    @FocusState private var passwordFieldFocused: Bool
    @State private var keyboardHeight: CGFloat = 0
    @State private var showPassword = false

    public init() {}

    public var body: some View {
        ZStack {
            AppTheme.background.ignoresSafeArea()
            ScrollView(.vertical, showsIndicators: false) {
                VStack(spacing: 0) {
                    logoSection
                    primaryLoginSection
                    alternativeLoginSection
                    agreementSection
                }
                .padding(.bottom, 40)
            }
        }
        .overlay(alignment: .topTrailing) {
            if router.isShowingLogin {
                Button("取消") { router.dismissLogin() }
                    .font(.body)
                    .foregroundColor(AppTheme.textSecondary)
                    .padding()
            }
        }
        .fullScreenCover(isPresented: $showPhoneLogin) {
            phoneLoginSheet
                .sheet(isPresented: $showCountryPicker) {
                    CountryPickerSheet(selected: $vm.selectedCountry)
                }
        }
        .sheet(item: $agreementWebSheet) { sheet in
            NavigationStack {
                InAppWebView(
                    url: sheet == .terms ? AppTheme.termsURL : AppTheme.privacyURL,
                    title: sheet == .terms ? "用户协议" : "隐私政策"
                )
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("关闭") { agreementWebSheet = nil }
                    }
                }
            }
        }
        .onChange(of: appState.isLoggedIn) { _, loggedIn in
            if loggedIn { showPhoneLogin = false }
        }
    }

    // MARK: - Logo + App 名称 + 标语
    private var logoSection: some View {
        VStack(spacing: 12) {
            Image("Logo")
                .resizable()
                .scaledToFit()
                .frame(width: 88, height: 88)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            Text(languageCode == "en" ? "StarLens AI" : "星识安全助手")
                .font(.title.bold())
                .foregroundColor(AppTheme.textPrimary)
            Text(languageCode == "en" ? "AI fraud protection for everyone" : "官方AI风险识别，守护你的安全")
                .font(.subheadline)
                .foregroundColor(AppTheme.textSecondary)
        }
        .padding(.top, 48)
        .padding(.bottom, 36)
    }

    // MARK: - 主登录：手机号 + 验证码（默认）
    private var primaryLoginSection: some View {
        VStack(spacing: 16) {
            Button {
                guard vm.canAttemptLogin else {
                    vm.errorMessage = languageCode == "en"
                        ? "Please read and agree to the Terms of Service and Privacy Policy first"
                        : "请先阅读并同意服务协议和隐私政策"
                    return
                }
                showPhoneLogin = true
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: "phone.fill")
                        .font(.title3)
                    Text(languageCode == "en" ? "Sign in with Phone" : "手机号登录")
                        .font(.headline)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .foregroundColor(.white)
                .background(vm.agreementAccepted ? AppTheme.primary : Color.gray)
                // 与系统 Sign in with Apple 按钮保持接近的圆角
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            }
            .disabled(!vm.agreementAccepted)

            if let msg = vm.errorMessage {
                Text(msg)
                    .font(.caption)
                    .foregroundColor(.red)
            }
        }
        .padding(.horizontal, 24)
        .padding(.bottom, 28)
    }

    // MARK: - 其他方式：Apple（微信先隐藏）
    private var alternativeLoginSection: some View {
        VStack(spacing: 12) {
            if vm.isLoggingIn {
                HStack(spacing: 10) {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                    Text(languageCode == "en" ? "Signing in with Apple…" : "苹果登录中…")
                        .font(.headline)
                        .foregroundColor(.white)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .background(Color.black)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            } else {
                SignInWithAppleButton(.signIn) { request in
                    request.requestedScopes = [.fullName, .email]
                } onCompletion: { result in
                    if !vm.canAttemptLogin {
                        vm.errorMessage = languageCode == "en"
                            ? "Please read and agree to the Terms of Service and Privacy Policy first"
                            : "请先阅读并同意服务协议和隐私政策"
                        return
                    }
                    handleAppleSignIn(result)
                }
                .signInWithAppleButtonStyle(.black)
                .frame(height: 44)
                .disabled(!vm.agreementAccepted)
                .opacity(vm.agreementAccepted ? 1.0 : 0.5)
            }
        }
        .padding(.horizontal, 24)
        .padding(.bottom, 32)
    }

    // MARK: - 协议勾选（《服务协议》《隐私政策》可点击打开）
    private var agreementSection: some View {
        HStack(alignment: .top, spacing: 12) {
            Button {
                vm.agreementAccepted.toggle()
            } label: {
                Image(systemName: vm.agreementAccepted ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundColor(vm.agreementAccepted ? AppTheme.primary : AppTheme.textSecondary)
            }
            VStack(alignment: .leading, spacing: 4) {
                if languageCode == "en" {
                    Text("I have read and agree to StarLens Safety Assistant's")
                        .foregroundColor(AppTheme.textSecondary)
                    HStack(spacing: 4) {
                        Button("Terms of Service") { agreementWebSheet = .terms }
                            .foregroundColor(AppTheme.primary)
                        Text("and")
                            .foregroundColor(AppTheme.textSecondary)
                        Button("Privacy Policy") { agreementWebSheet = .privacy }
                            .foregroundColor(AppTheme.primary)
                    }
                    Text("Accounts and permissions are not shared across platforms.")
                        .foregroundColor(AppTheme.textSecondary)
                } else {
                    HStack(spacing: 0) {
                        Text("已阅读并同意 星识安全助手 的")
                            .foregroundColor(AppTheme.textSecondary)
                        Button("《服务协议》") { agreementWebSheet = .terms }
                            .foregroundColor(AppTheme.primary)
                        Text("和")
                            .foregroundColor(AppTheme.textSecondary)
                        Button("《隐私政策》") { agreementWebSheet = .privacy }
                            .foregroundColor(AppTheme.primary)
                    }
                    Text("各账户资产与权限不互通")
                        .foregroundColor(AppTheme.textSecondary)
                }
            }
            .font(.caption)
        }
        .padding(.horizontal, 24)
        .padding(.bottom, 24)
    }

    // MARK: - 手机号 + 密码（登录/注册）
    private var phoneLoginSheet: some View {
        NavigationStack {
            Form {
                Section(languageCode == "en" ? "Phone & Password" : "手机号 + 密码") {
                    // 国家区号选择 + 手机号
                    HStack(alignment: .center, spacing: 10) {
                        Button {
                            showCountryPicker = true
                        } label: {
                            HStack(spacing: 6) {
                                Text(selectedCountryDisplayName)
                                    .font(.body)
                                    .foregroundColor(AppTheme.textPrimary)
                                Image(systemName: "chevron.down.circle.fill")
                                    .font(.caption)
                                    .foregroundColor(AppTheme.textSecondary)
                            }
                            .padding(.vertical, 4)
                        }
                        .buttonStyle(.plain)
                        TextField(
                            languageCode == "en" ? "Mobile number" : "手机号码",
                            text: $vm.nationalNumber
                        )
                        .keyboardType(.phonePad)
                        .focused($phoneFieldFocused)
                        .onChange(of: vm.nationalNumber) { _, newValue in
                            // 按国家最大位数实时截断（CN=11、US=10 ...），输入纯数字
                            let digits = newValue.filter(\.isNumber)
                            let maxLen = PhoneCountry.maxNationalNumberLength(iso: vm.selectedCountry.id)
                            let trimmed = String(digits.prefix(maxLen))
                            if trimmed != newValue {
                                vm.nationalNumber = trimmed
                            }
                        }
                        .onChange(of: vm.selectedCountry) { _, newCountry in
                            // 切换国家时按新国家上限再截一次
                            let digits = vm.nationalNumber.filter(\.isNumber)
                            let maxLen = PhoneCountry.maxNationalNumberLength(iso: newCountry.id)
                            vm.nationalNumber = String(digits.prefix(maxLen))
                        }
                    }
                    .frame(minHeight: 46)
                    if let phoneError = vm.phoneInputError, !phoneError.isEmpty {
                        Text(phoneError)
                            .font(.caption2)
                            .foregroundColor(.red)
                    }
                    // 密码
                    HStack {
                        Group {
                            if showPassword {
                                TextField(languageCode == "en" ? "Password (min. 8 characters)" : "密码（至少 8 位）", text: $vm.password)
                            } else {
                                SecureField(languageCode == "en" ? "Password (min. 8 characters)" : "密码（至少 8 位）", text: $vm.password)
                            }
                        }
                        .focused($passwordFieldFocused)
                        Button {
                            showPassword.toggle()
                        } label: {
                            Image(systemName: showPassword ? "eye.slash" : "eye")
                                .foregroundColor(AppTheme.textSecondary)
                        }
                        .buttonStyle(.plain)
                    }
                    .frame(minHeight: 46)
                    if let pwdError = vm.passwordInputError, !pwdError.isEmpty {
                        Text(pwdError)
                            .font(.caption2)
                            .foregroundColor(.red)
                    }
                }
                if !vm.agreementAccepted {
                    Text(languageCode == "en"
                         ? "Please agree to the Terms and Privacy Policy on the login page first."
                         : "请先在登录页勾选同意服务协议和隐私政策")
                        .font(.caption)
                        .foregroundColor(.red)
                }
                Section {
                    VStack(spacing: 10) {
                        // 登录/注册按钮
                        Button {
                            vm.loginWithPhone()
                        } label: {
                            Group {
                                if vm.isLoggingIn {
                                    ProgressView()
                                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                        .frame(maxWidth: .infinity)
                                } else {
                                    Text(languageCode == "en" ? "Sign in / Register" : "登录 / 注册")
                                        .frame(maxWidth: .infinity)
                                }
                            }
                            .font(.headline)
                            .foregroundColor(.white)
                            .frame(height: 44)
                            .background((vm.canLoginWithPhone && !vm.isLoggingIn) ? AppTheme.primary : AppTheme.primary.opacity(0.35))
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        }
                        .disabled(!vm.canLoginWithPhone || vm.isLoggingIn)
                        .buttonStyle(.plain)
                        // 密码安全提示
                        Text(languageCode == "en"
                             ? "Your password is yours alone — keep it safe"
                             : "密码仅您可知，请妥善保管，丢失后无法找回")
                            .font(.caption)
                            .foregroundColor(AppTheme.textSecondary)
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: .infinity)
                    }
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 8, trailing: 16))
                }
            }
            .navigationTitle(languageCode == "en" ? "Sign in / Register" : "登录 / 注册")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(languageCode == "en" ? "Cancel" : "取消") { showPhoneLogin = false }
                }
            }
            .task {
                // 国家提示在后台跑，不阻塞焦点设置（之前 await 阻塞导致键盘弹不出）
                Task { await vm.refreshCountryHint() }
                // 等 sheet 动画完成（iOS 17 sheet 动画 ~250ms）
                try? await Task.sleep(nanoseconds: 350_000_000)
                phoneFieldFocused = true
                // 二次保险：再 200ms 后再 set 一次（防 SwiftUI focus 在 sheet 内部丢）
                try? await Task.sleep(nanoseconds: 200_000_000)
                if !phoneFieldFocused { phoneFieldFocused = true }
            }
        }
    }

    private var isChineseSystem: Bool {
        Locale.preferredLanguages.first?.lowercased().hasPrefix("zh") == true
    }

    private var selectedCountryDisplayName: String {
        let name = isChineseSystem ? vm.selectedCountry.nameZh : vm.selectedCountry.nameEn
        return "\(name)(\(vm.selectedCountry.dialCode))"
    }

    private func handleAppleSignIn(_ result: Result<ASAuthorization, Error>) {
        switch result {
        case .failure(let error):
            if let authError = error as? ASAuthorizationError {
                switch authError.code {
                case .canceled:
                    // 用户主动取消时不提示错误，避免干扰体验
                    vm.errorMessage = nil
                case .notHandled:
                    vm.errorMessage = languageCode == "en" ? "Apple sign-in failed. Please try again." : "苹果登录未完成，请重试"
                case .failed:
                    vm.errorMessage = languageCode == "en" ? "Apple sign-in failed. Please try again." : "苹果登录失败，请稍后重试"
                case .invalidResponse:
                    vm.errorMessage = languageCode == "en" ? "Invalid Apple sign-in response." : "苹果登录响应无效"
                case .unknown:
                    vm.errorMessage = languageCode == "en" ? "Apple sign-in is currently unavailable." : "苹果登录暂时不可用"
                case .notInteractive:
                    vm.errorMessage = languageCode == "en" ? "Apple sign-in is not available in current context." : "当前场景暂不支持苹果登录"
                @unknown default:
                    vm.errorMessage = languageCode == "en" ? "Apple sign-in failed. Please try again." : "苹果登录失败，请重试"
                }
            } else {
                vm.errorMessage = languageCode == "en" ? "Apple sign-in failed. Please try again." : "苹果登录失败，请重试"
            }
        case .success(let auth):
            guard let credential = auth.credential as? ASAuthorizationAppleIDCredential else {
                vm.errorMessage = languageCode == "en" ? "Apple login failed" : "苹果登录失败"
                return
            }
            guard let tokenData = credential.identityToken,
                  let identityToken = String(data: tokenData, encoding: .utf8),
                  !identityToken.isEmpty else {
                vm.errorMessage = languageCode == "en" ? "Missing Apple token" : "未获取到苹果登录凭证"
                return
            }
            let fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
                .compactMap { $0 }
                .joined(separator: " ")
                .trimmingCharacters(in: .whitespacesAndNewlines)
            let displayName = fullName.isEmpty ? nil : fullName
            vm.loginWithApple(identityToken: identityToken, appleUser: credential.user, displayName: displayName)
        }
    }
}

#if DEBUG
struct LoginView_Previews: PreviewProvider {
    static var previews: some View {
        LoginView()
            .environmentObject(AppStateViewModel.shared)
            .environmentObject(AppRouter.shared)
    }
}
#endif
