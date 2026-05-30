//
//  ElderHomeView.swift
//  IsItSafe
//
//  V3-J 长辈模式首页（对应 mockup J-P1）
//  替换普通首页 HomeContainerView；开关在"我的"
//
//  布局：
//   - 顶部："您好，XX"问候 + 头像
//   - 中部：3 个超大按钮（检测 / 拨打孩子 / 我被骗了）
//   - 底部 SOS bar（红色，长按拨打第一 guardian）
//

import SwiftUI

public struct ElderHomeView: View {
    @EnvironmentObject private var appState: AppStateViewModel
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    @State private var showDetection = false
    @State private var showSOS = false

    public init() {}

    public var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                greetingHeader

                VStack(spacing: 16) {
                    bigButton(
                        icon: "🔍",
                        title: languageCode == "en" ? "Is this a scam?" : "这是不是骗子？",
                        bg: AppTheme.primary,
                        action: { showDetection = true }
                    )

                    bigButton(
                        icon: "📞",
                        title: languageCode == "en" ? "Call my child" : "给孩子打电话",
                        bg: AppTheme.riskLow,
                        action: { showSOS = true }
                    )
                    // S5-8：删"我被骗了"按钮 — 给长辈太复杂，
                    //   "给孩子打电话" 已涵盖紧急求助场景。
                }
                .padding(.horizontal, 20)
                .padding(.top, 24)

                Spacer()
                // S5-8：删底部 SOS bar — "给孩子打电话" 已等效，避免重复入口
            }
            .background(AppTheme.background.ignoresSafeArea())
            .navigationBarHidden(true)
            .fullScreenCover(isPresented: $showDetection) {
                ElderDetectionView()
            }
            .fullScreenCover(isPresented: $showSOS) {
                ElderSOSView()
            }
            // 检测页请求"立刻打孩子电话" → 弹 SOS 拨号
            .onReceive(NotificationCenter.default.publisher(for: .elderRequestCallGuardian)) { _ in
                showDetection = false
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    showSOS = true
                }
            }
        }
    }

    private var greetingHeader: some View {
        VStack(spacing: 8) {
            // 头像
            ZStack {
                Circle()
                    .fill(LinearGradient(colors: [AppTheme.primary.opacity(0.7), AppTheme.primary],
                                         startPoint: .topLeading,
                                         endPoint: .bottomTrailing))
                    .frame(width: 84, height: 84)
                Text(String(displayName.prefix(1)))
                    .font(.system(size: 30, weight: .bold))
                    .foregroundColor(.white)
            }
            .padding(.top, 32)

            Text(greetingText)
                .font(.system(size: 26, weight: .semibold))
                .foregroundColor(AppTheme.textPrimary)

            Text(dateText)
                .font(.system(size: 16))
                .foregroundColor(AppTheme.textSecondary)
        }
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder
    private func bigButton(icon: String, title: String, bg: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 16) {
                Text(icon).font(.system(size: 36))
                Text(title)
                    .font(.system(size: 24, weight: .bold))
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                Spacer()
            }
            .foregroundColor(.white)
            .frame(maxWidth: .infinity, minHeight: 84)
            .padding(.horizontal, 20)
            .background(bg)
            .clipShape(RoundedRectangle(cornerRadius: 18))
            .shadow(color: bg.opacity(0.3), radius: 8, x: 0, y: 4)
        }
    }

    private var displayName: String {
        if let nick = appState.user?.wechatNickname, !nick.isEmpty { return nick }
        if let nick = appState.user?.nickname, !nick.isEmpty { return nick }
        return languageCode == "en" ? "Friend" : "您"
    }

    private var greetingText: String {
        if languageCode == "en" {
            return "Hello, \(displayName)"
        }
        return "您好，\(displayName)"
    }

    private var dateText: String {
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: languageCode == "en" ? "en_US" : "zh_CN")
        fmt.dateFormat = languageCode == "en" ? "EEEE, MMM d" : "M 月 d 日 EEEE"
        return fmt.string(from: Date())
    }
}
