//
//  HomeIntelBanner.swift
//  IsItSafe
//
//  V3-B 首页通知条：仅当未读官方情报存在时显示
//  点击 → 跳「情报案例」Tab + Daily Intel segment（通过 router）
//

import SwiftUI

public struct HomeIntelBanner: View {
    @StateObject private var vm = IntelViewModel()
    @EnvironmentObject private var router: AppRouter
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"

    public init() {}

    public var body: some View {
        Group {
            if vm.unreadCount > 0 {
                Button {
                    // 切到情报案例 Tab（index = 1）
                    router.pendingTabIndex = 1
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: "newspaper.fill")
                            .font(.system(size: 16))
                            .foregroundColor(.white)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(languageCode == "en"
                                 ? "Official Intel: \(vm.unreadCount) unread"
                                 : "官方提醒：\(vm.unreadCount) 条未读情报")
                                .font(.subheadline.weight(.semibold))
                                .foregroundColor(.white)
                            Text(languageCode == "en" ? "Tap to view" : "点击查看")
                                .font(.caption2)
                                .foregroundColor(.white.opacity(0.85))
                        }
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(.white.opacity(0.85))
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(
                        LinearGradient(colors: [AppTheme.primary, AppTheme.premiumHeader],
                                       startPoint: .topLeading, endPoint: .bottomTrailing)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .shadow(color: AppTheme.primary.opacity(0.25), radius: 6, x: 0, y: 3)
                }
                .buttonStyle(.plain)
                .padding(.top, 4)
            }
        }
        .onAppear {
            Task { await vm.refreshUnreadCount() }
        }
    }
}
