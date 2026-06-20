//
//  FamilyView.swift
//  IsItSafe
//
//  V3-E 家庭 Tab 主入口
//  根据 FamilyViewModel.state 渲染：
//    .notLoggedIn → 引导登录
//    .loading     → 骨架
//    .empty       → 创建家庭组引导（E-P2 + E-P10）
//    .loaded      → 家庭组首页（E-P1）
//    .error       → 错误状态 + 重试
//

import SwiftUI

public struct FamilyView: View {
    @StateObject private var vm = FamilyViewModel()
    @EnvironmentObject private var router: AppRouter
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    @State private var showCreateSheet = false
    @State private var showRedeemSheet = false

    public init() {}

    public var body: some View {
        NavigationStack {
            content
                .navigationTitle(languageCode == "en" ? "Family" : "家庭")
                .navigationBarTitleDisplayMode(.inline)
                .background(AppTheme.background)
                .toolbarBackground(AppTheme.background, for: .navigationBar)
        }
        .onAppear {
            // 启动时已经携带 pending 邀请码 → 立即打开兑换 sheet
            if router.pendingInviteCode != nil {
                showRedeemSheet = true
            }
            // V4 复核 #11：之前 onAppear 同步 refresh() + Task 内 await 心跳后又 refresh() 一次
            //                两个请求并发，URLSession 可能取消其中一次抛 CancellationError；
            //                同时 access_token 接近过期还会让两次都触发 refresh_token。
            //                现在改为一次性流程：先心跳（让 server 拿到最新 lastActiveAt），
            //                再刷新成员列表 → 用户看到的活跃状态既最新又没有竞态。
            Task {
                HeartbeatService.shared.resetThrottle()
                await HeartbeatService.shared.reportActive(trigger: .foreground)
                await MainActor.run { vm.refresh() }
            }
        }
        // Universal Link 拉起家庭 Tab + 携带邀请码 → 自动弹兑换 sheet
        .onChange(of: router.pendingInviteCode) { _, code in
            if code != nil { showRedeemSheet = true }
        }
        .sheet(isPresented: $showCreateSheet) {
            CreateFamilyGroupSheet(vm: vm)
        }
        .sheet(isPresented: $showRedeemSheet, onDismiss: {
            // 兑换页关闭后清除 router pending code
            router.pendingInviteCode = nil
        }) {
            RedeemInviteSheet(vm: vm, prefilledCode: router.pendingInviteCode)
        }
    }

    @ViewBuilder
    private var content: some View {
        switch vm.state {
        case .loading:
            loadingView
        case .notLoggedIn:
            notLoggedInView
        case .empty:
            FamilyEmptyView(
                onCreate: { showCreateSheet = true },
                onRedeem: { showRedeemSheet = true }
            )
        case .loaded(let group):
            FamilyGroupView(group: group, vm: vm)
        case .error(let msg):
            errorView(message: msg)
        }
    }

    // MARK: - 子状态 View

    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
            Text(languageCode == "en" ? "Loading..." : "加载中…")
                .font(.subheadline)
                .foregroundColor(AppTheme.textSecondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var notLoggedInView: some View {
        VStack(spacing: 20) {
            Image(systemName: "person.2.fill")
                .font(.system(size: 56))
                .foregroundColor(AppTheme.primary)
            Text(languageCode == "en" ? "Sign in to use Family Guard" : "登录后使用家庭守护")
                .font(.title3.weight(.semibold))
            Text(languageCode == "en"
                 ? "Create or join a family group to protect each other"
                 : "创建或加入家庭组，全家互相守护")
                .font(.subheadline)
                .foregroundColor(AppTheme.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Button {
                router.showLogin()
            } label: {
                Text(languageCode == "en" ? "Sign in" : "立即登录")
                    .font(.body.weight(.semibold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(AppTheme.primary)
                    .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.medium))
            }
            .padding(.horizontal, 24)
            .padding(.top, 12)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
    }

    private func errorView(message: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 48))
                .foregroundColor(AppTheme.riskMedium)
            Text(languageCode == "en" ? "Failed to load" : "加载失败")
                .font(.headline)
            Text(message)
                .font(.subheadline)
                .foregroundColor(AppTheme.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Button {
                vm.refresh()
            } label: {
                Text(languageCode == "en" ? "Retry" : "重试")
                    .font(.body.weight(.semibold))
                    .foregroundColor(AppTheme.primary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(AppTheme.primary.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.medium))
            }
            .padding(.horizontal, 32)
            .padding(.top, 8)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
    }
}
