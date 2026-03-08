//
//  LoginView.swift
//  IsItSafe
//
//  登录页：样式参考设计图2。默认微信登录，支持手机号+验证码、苹果快捷登录；须同意协议方可登录；提供游客入口。
//

import SwiftUI

public struct LoginView: View {
    @StateObject private var vm = LoginViewModel()
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppStateViewModel
    @EnvironmentObject private var router: AppRouter
    @State private var showPhoneLogin = false

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
                    guestEntrySection
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
        .sheet(isPresented: $showPhoneLogin) {
            phoneLoginSheet
        }
        .onChange(of: appState.isLoggedIn) { _, loggedIn in
            if loggedIn { showPhoneLogin = false }
        }
    }

    // MARK: - Logo + App 名称 + 标语
    private var logoSection: some View {
        VStack(spacing: 12) {
            Image(systemName: "shield.checkered")
                .font(.system(size: 64))
                .foregroundStyle(AppTheme.primary)
                .frame(width: 88, height: 88)
                .background(AppTheme.primary.opacity(0.12))
                .clipShape(Circle())
            Text("IsItSafe")
                .font(.title.bold())
                .foregroundColor(AppTheme.textPrimary)
            Text("安全识别，防诈先行")
                .font(.subheadline)
                .foregroundColor(AppTheme.textSecondary)
        }
        .padding(.top, 48)
        .padding(.bottom, 36)
    }

    // MARK: - 主登录：微信登录（默认）
    private var primaryLoginSection: some View {
        VStack(spacing: 16) {
            Button {
                guard vm.canAttemptLogin else {
                    vm.errorMessage = "请先阅读并同意服务协议和隐私政策"
                    return
                }
                // TODO: 接入微信 SDK
                vm.errorMessage = "微信登录即将开放"
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: "bubble.left.and.bubble.right.fill")
                        .font(.title3)
                        .foregroundColor(.white)
                    Text("微信登录")
                        .font(.headline)
                        .foregroundColor(.white)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(vm.agreementAccepted ? AppTheme.premiumStatusCard : Color.gray)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
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

    // MARK: - 三种方式：游客、手机号、Apple
    private var alternativeLoginSection: some View {
        HStack(spacing: 40) {
            alternativeButton(icon: "person.crop.circle", label: "游客") {
                vm.enterGuestMode()
            }
            alternativeButton(icon: "phone.fill", label: "手机号") {
                showPhoneLogin = true
            }
            alternativeButton(icon: "apple.logo", label: "Apple") {
                guard vm.canAttemptLogin else {
                    vm.errorMessage = "请先阅读并同意服务协议和隐私政策"
                    return
                }
                // TODO: Sign in with Apple
                vm.errorMessage = "苹果登录即将开放"
            }
        }
        .padding(.bottom, 32)
    }

    private func alternativeButton(icon: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 28))
                    .foregroundColor(AppTheme.textPrimary)
                Text(label)
                    .font(.caption)
                    .foregroundColor(AppTheme.textSecondary)
            }
            .frame(width: 64, height: 64)
        }
        .buttonStyle(.plain)
    }

    // MARK: - 协议勾选
    private var agreementSection: some View {
        HStack(alignment: .top, spacing: 12) {
            Button {
                vm.agreementAccepted.toggle()
            } label: {
                Image(systemName: vm.agreementAccepted ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundColor(vm.agreementAccepted ? AppTheme.primary : AppTheme.textSecondary)
            }
            Text(agreementAttributedText())
                .font(.caption)
                .foregroundColor(AppTheme.textSecondary)
        }
        .padding(.horizontal, 24)
        .padding(.bottom, 24)
    }

    private func agreementAttributedText() -> String {
        "已阅读并同意 IsItSafe 的《服务协议》和《隐私政策》，各账户资产与权限不互通"
    }

    // MARK: - 游客入口
    private var guestEntrySection: some View {
        Button {
            vm.enterGuestMode()
        } label: {
            VStack(spacing: 4) {
                Text("游客入口")
                    .font(.subheadline.weight(.medium))
                    .foregroundColor(AppTheme.primary)
                Text("点击后可以进入到现在的模拟数据")
                    .font(.caption2)
                    .foregroundColor(AppTheme.textSecondary)
            }
        }
        .buttonStyle(.plain)
    }

    // MARK: - 手机号+验证码 Sheet
    private var phoneLoginSheet: some View {
        NavigationStack {
            Form {
                Section("手机号登录") {
                    TextField("手机号", text: $vm.phone)
                        .keyboardType(.phonePad)
                    TextField("验证码", text: $vm.smsCode)
                        .keyboardType(.numberPad)
                }
                if !vm.agreementAccepted {
                    Text("请先在登录页勾选同意服务协议和隐私政策")
                        .font(.caption)
                        .foregroundColor(.red)
                }
                Section {
                    Button {
                        vm.loginWithPhone()
                    } label: {
                        HStack {
                            Spacer()
                            if vm.isLoggingIn {
                                ProgressView()
                            } else {
                                Text("登录")
                            }
                            Spacer()
                        }
                        .padding(.vertical, 8)
                    }
                    .disabled(!vm.canLoginWithPhone || vm.isLoggingIn)
                }
            }
            .navigationTitle("手机号登录")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") { showPhoneLogin = false }
                }
            }
        }
        .presentationDetents([.medium])
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
