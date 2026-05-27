//
//  IntelListView.swift
//  IsItSafe
//
//  V3-B "情报案例" Tab 中"今日情报" segment 内容
//  紧急 banner（高亮） + 列表（按 severity + time 排序）
//

import SwiftUI

public struct IntelListView: View {
    @StateObject private var vm = IntelViewModel()
    @State private var selectedDetail: IntelAlertSummary?
    @State private var showSubmit = false
    @State private var showPreferences = false
    @State private var showOnboarding = false
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    @AppStorage("isitsafe.intelOnboarded") private var onboarded: Bool = false

    public init() {}

    public var body: some View {
        ZStack {
            AppTheme.background.ignoresSafeArea()
            content
        }
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button { showPreferences = true } label: {
                    Image(systemName: "slider.horizontal.3")
                }
                .a11y(label: languageCode == "en" ? "Intel preferences" : "情报偏好")
            }
        }
        .onAppear {
            vm.refresh()
            // 首次进入情报 Tab + 已登录 → 弹引导
            if !onboarded && AuthInterceptor.token() != nil {
                showOnboarding = true
            }
        }
        .navigationDestination(item: $selectedDetail) { item in
            IntelDetailView(summary: item)
                .mainTabBarHidden()
        }
        .sheet(isPresented: $showSubmit) {
            IntelSubmitSheet()
        }
        .sheet(isPresented: $showPreferences) {
            IntelPreferencesView()
        }
        .sheet(isPresented: $showOnboarding, onDismiss: { vm.refresh() }) {
            IntelOnboardingSheet()
        }
    }

    @ViewBuilder
    private var content: some View {
        switch vm.state {
        case .loading:
            ProgressView()
        case .notLoggedIn:
            notLoggedInState
        case .empty:
            emptyState
        case .error(let msg):
            errorState(msg)
        case .loaded(let items):
            list(items: items)
        }
    }

    private var notLoggedInState: some View {
        VStack(spacing: 14) {
            Image(systemName: "newspaper")
                .font(.system(size: 48))
                .foregroundColor(AppTheme.primary)
            Text(languageCode == "en" ? "Sign in to see daily intel" : "登录后查看每日情报")
                .font(.subheadline)
                .foregroundColor(AppTheme.textSecondary)
        }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "tray")
                .font(.system(size: 48))
                .foregroundColor(AppTheme.textSecondary.opacity(0.6))
            Text(languageCode == "en" ? "No intel yet" : "暂无情报")
                .font(.subheadline)
                .foregroundColor(AppTheme.textSecondary)
        }
    }

    private func errorState(_ msg: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 36))
                .foregroundColor(AppTheme.riskMedium)
            Text(msg).font(.caption).foregroundColor(AppTheme.textSecondary)
            Button(languageCode == "en" ? "Retry" : "重试") { vm.refresh() }
                .font(.body.weight(.semibold))
                .foregroundColor(AppTheme.primary)
        }
        .padding()
    }

    private func list(items: [IntelAlertSummary]) -> some View {
        ScrollView {
            VStack(spacing: 10) {
                // 紧急 banner（第一条 urgent 单独突出）
                if let urgent = items.first, urgent.severity == .urgent {
                    urgentBanner(urgent)
                    ForEach(items.dropFirst()) { item in
                        intelCard(item)
                    }
                } else {
                    ForEach(items) { item in
                        intelCard(item)
                    }
                }
                submitInviteButton
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
        .refreshable { vm.refresh() }
    }

    private func urgentBanner(_ item: IntelAlertSummary) -> some View {
        Button { selectedDetail = item } label: {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 6) {
                    Text("🚨").font(.system(size: 18))
                    Text(languageCode == "en" ? "URGENT" : "紧急")
                        .font(.caption.weight(.heavy))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.white.opacity(0.25))
                        .clipShape(Capsule())
                    Spacer()
                    Text(relativeTime(item.publishedAt))
                        .font(.caption2)
                        .opacity(0.9)
                }
                Text(item.title)
                    .font(.headline)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                Text(item.summary)
                    .font(.caption)
                    .opacity(0.92)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
            }
            .foregroundColor(.white)
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                LinearGradient(colors: [AppTheme.riskHigh, AppTheme.riskMedium],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
            )
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .shadow(color: AppTheme.riskHigh.opacity(0.3), radius: 8, x: 0, y: 4)
        }
    }

    private func intelCard(_ item: IntelAlertSummary) -> some View {
        Button { selectedDetail = item } label: {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 6) {
                    Text(severityLabel(item.severity))
                        .font(.caption2.weight(.bold))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(severityColor(item.severity).opacity(0.15))
                        .foregroundColor(severityColor(item.severity))
                        .clipShape(Capsule())
                    Text(item.category)
                        .font(.caption2)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color(.systemGray6))
                        .clipShape(Capsule())
                    Spacer()
                    if !item.isRead {
                        Circle().fill(AppTheme.primary).frame(width: 6, height: 6)
                    }
                    Text(relativeTime(item.publishedAt))
                        .font(.caption2)
                        .foregroundColor(AppTheme.textSecondary)
                }
                Text(item.title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(AppTheme.textPrimary)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                Text(item.summary)
                    .font(.caption)
                    .foregroundColor(AppTheme.textSecondary)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(AppTheme.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
    }

    private var submitInviteButton: some View {
        Button { showSubmit = true } label: {
            HStack {
                Image(systemName: "exclamationmark.bubble")
                Text(languageCode == "en" ? "I encountered a new scam" : "我遇到过新骗局")
            }
            .font(.subheadline.weight(.semibold))
            .foregroundColor(AppTheme.primary)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(AppTheme.primary.opacity(0.08))
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .padding(.top, 6)
    }

    private func severityLabel(_ s: IntelSeverity) -> String {
        s.displayName
    }
    private func severityColor(_ s: IntelSeverity) -> Color {
        switch s {
        case .urgent: return AppTheme.riskHigh
        case .high: return AppTheme.riskMedium
        case .normal: return AppTheme.primary
        }
    }
    private func relativeTime(_ iso: String?) -> String {
        guard let iso else { return "" }
        let fmts: [ISO8601DateFormatter.Options] = [
            [.withInternetDateTime, .withFractionalSeconds],
            [.withInternetDateTime],
        ]
        for opts in fmts {
            let f = ISO8601DateFormatter()
            f.formatOptions = opts
            if let d = f.date(from: iso) {
                let interval = -d.timeIntervalSinceNow
                if interval < 3600 { return "\(Int(interval / 60))m" }
                if interval < 86400 { return "\(Int(interval / 3600))h" }
                let days = Int(interval / 86400)
                return "\(days)d"
            }
        }
        return ""
    }
}
