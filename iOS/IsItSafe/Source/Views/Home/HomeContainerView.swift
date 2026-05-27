//
//  HomeContainerView.swift
//  IsItSafe
//
//  首页容器：顶部栏、侧滑抽屉（历史/搜索/设置/新建对话）、主内容、输入栏。
//

import SwiftUI
import UIKit
import Foundation

public struct HomeContainerView: View {
    @ObservedObject var homeVm: HomeViewModel
    @ObservedObject var historyVm: HistoryViewModel
    @FocusState private var isInputFocused: Bool
    @State private var showSidebar = false
    @State private var showScreenshotSheet = false
    @State private var screenshotOCRText = ""
    @State private var showImagePicker = false
    @State private var showPhotoLibrary = false
    @State private var showCameraCapture = false
    @State private var showDeepfake = false
    @State private var confirmPhotoItem: ConfirmPhotoItem?
    @State private var showClipboardAlert = false
    @State private var previousScenePhase: ScenePhase?
    @State private var showSettings = false
    @State private var showPremiumSheet = false
    @State private var historySearchText = ""
    @State private var selectedHistoryItem: QueryHistoryItem?
    @State private var historyItemToDelete: QueryHistoryItem?
    @State private var voiceRecordingTask: Task<Void, Never>?
    @State private var voiceHintText = "按住说话"
    @EnvironmentObject private var appState: AppStateViewModel
    @EnvironmentObject private var router: AppRouter
    @Environment(\.scenePhase) private var scenePhase
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"

    public init(homeVm: HomeViewModel, historyVm: HistoryViewModel) {
        self.homeVm = homeVm
        self.historyVm = historyVm
    }

    /// 冷启动剪贴板只弹一次：底导切回首页会再次 onAppear，用此标记区分
    private static var hasDoneColdStartClipboardCheck = false

    private let sidebarWidth = min(320, UIScreen.main.bounds.width * 0.85)

    private func maybeInjectLocalDefaultQAIfNeeded() {
        // 只在当前页面没有消息时才注入，避免干扰用户正常会话
        guard homeVm.turns.isEmpty, homeVm.loadedHistoryId == nil else { return }
        guard LocalDefaultQAStore.shared.shouldShowDefaultQA() else { return }

        let now = Date()
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        let localId = UUID().uuidString
        let record = LocalDefaultConversationRecord(
            localConversationId: localId,
            createdAtISO: formatter.string(from: now),
            serverConversationId: nil
        )

        LocalDefaultQAStore.shared.saveDefaultConversationRecord(record)
        LocalDefaultQAStore.shared.markDefaultQAShown()

        homeVm.reset()
        homeVm.turns = LocalDefaultQAContent.defaultTurns(languageCode: languageCode)
        homeVm.loadedHistoryId = localId
        homeVm.currentConversationId = nil
        homeVm.state = .idle
    }

    private func localDefaultConversationTitle() -> String {
        // 对齐 HistoryTitleHelper：只取第一句并做截断
        let raw = languageCode == "en"
        ? "Someone asked me to send money. Scam?"
        : "有人让我转钱，这是诈骗吗？"
        .trimmingCharacters(in: .whitespacesAndNewlines)
        if raw.count <= 28 { return raw }
        return String(raw.prefix(28)) + "…"
    }

    public var body: some View {
        ZStack(alignment: .leading) {
            // 主内容：侧边栏打开时整体向右推移
            mainContent
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .offset(x: showSidebar ? sidebarWidth : 0)
            if showSidebar {
                Color.black.opacity(0.3)
                    .ignoresSafeArea()
                    .onTapGesture { showSidebar = false }
                sidebar
                    .transition(.move(edge: .leading))
            }
        }
        .animation(.easeInOut(duration: 0.25), value: showSidebar)
        .sheet(isPresented: $showScreenshotSheet) {
            UploadScreenshotSheet(ocrText: $screenshotOCRText) { text in
                homeVm.analyzeScreenshot(ocrText: text)
            }
        }
        .sheet(isPresented: $showSettings) {
            SettingsView()
                .environmentObject(appState)
                .mainTabBarHidden()
        }
        .sheet(isPresented: $showPremiumSheet) {
            NavigationStack {
                PremiumSubscriptionView()
                    .environmentObject(appState)
            }
        }
        .sheet(isPresented: $showImagePicker) {
            MediaPickerSheet(
                onCamera: {
                    showImagePicker = false
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                        showCameraCapture = true
                    }
                },
                onPhotoLibrary: {
                    showImagePicker = false
                    showPhotoLibrary = true
                },
                onDeepfake: {
                    showImagePicker = false
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                        showDeepfake = true
                    }
                },
                onSelectRecent: { img in
                    homeVm.pendingImage = img
                    showImagePicker = false
                }
            )
            .presentationDetents([.height(420), .medium])
            .presentationDragIndicator(.visible)
        }
        .fullScreenCover(isPresented: $showDeepfake) {
            DeepfakeView()
        }
        .fullScreenCover(isPresented: $showPhotoLibrary) {
            PhotoLibraryPicker { data in
                if let data = data, let img = UIImage(data: data) {
                    homeVm.pendingImage = img
                }
                DispatchQueue.main.async { showPhotoLibrary = false }
            }
        }
        .fullScreenCover(isPresented: $showCameraCapture) {
            CameraCaptureView(
                onImage: { img in
                    showCameraCapture = false
                    confirmPhotoItem = ConfirmPhotoItem(image: img)
                },
                onCancel: { showCameraCapture = false }
            )
        }
        .sheet(item: $confirmPhotoItem) { item in
            ConfirmPhotoSheet(image: item.image, onConfirm: {
                homeVm.pendingImage = item.image
                confirmPhotoItem = nil
            }, onCancel: { confirmPhotoItem = nil })
        }
        .alert(languageCode == "en" ? "Clipboard" : "剪贴板", isPresented: $showClipboardAlert) {
            Button(languageCode == "en" ? "Allow" : "允许") {
                if let str = UIPasteboard.general.string, !str.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    homeVm.inputText = str
                    isInputFocused = true
                }
            }
            Button(languageCode == "en" ? "Don't allow" : "不允许", role: .cancel) { }
        } message: {
            Text(languageCode == "en" ? "Paste clipboard content into the input box?" : "是否将剪贴板内容填入输入框？")
        }
        .onChange(of: scenePhase) { oldPhase, newPhase in
            previousScenePhase = newPhase
            // 从后台/未激活回到 active：刷新登录态 + 订阅状态，避免显示过期信息
            if newPhase == .active && oldPhase != .active {
                Task {
                    await MainActor.run { appState.refreshLoginState() }
                    await appState.refreshSubscriptionState()
                    // V3-E 心跳上报（关怀机制依赖；内部已节流 5 分钟）
                    await HeartbeatService.shared.reportActive()
                }
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification)) { _ in
            // 从后台回到前台不新开对话，仅检查剪贴板
            if let str = UIPasteboard.general.string, !str.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                showClipboardAlert = true
            }
        }
        .onChange(of: showSidebar) { _, isOpen in
            if isOpen { historyVm.refresh() }
        }
        .onChange(of: homeVm.showDailyQuotaAlert) { _, isShowing in
            if isShowing { isInputFocused = false }
        }
        .onAppear {
            if previousScenePhase == nil {
                previousScenePhase = scenePhase
                maybeInjectLocalDefaultQAIfNeeded()
                if !Self.hasDoneColdStartClipboardCheck {
                    Self.hasDoneColdStartClipboardCheck = true
                    if let str = UIPasteboard.general.string, !str.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        showClipboardAlert = true
                    }
                }
                // V3-E 冷启即时上报心跳一次（关怀机制；服务端按今日 active_count 计数）
                Task { await HeartbeatService.shared.reportActive() }
            }
        }
        .navigationDestination(item: $selectedHistoryItem) { item in
            HistoryDetailView(item: item)
                .mainTabBarHidden()
        }
        .alert(
            languageCode == "en" ? "Daily Limit Reached" : "今日额度已用完",
            isPresented: $homeVm.showDailyQuotaAlert
        ) {
            Button(languageCode == "en" ? "Subscribe Now" : "立即订阅") {
                showPremiumSheet = true
            }
            Button(languageCode == "en" ? "Later" : "稍后再说", role: .cancel) {}
        } message: {
            let limit = AppSettingsStore.maxFreeQueriesPerDay
            Text(languageCode == "en"
                 ? "You've used all \(limit) free queries today. Subscribe to get unlimited access."
                 : "今日 \(limit) 次免费额度已用完，订阅会员后可无限次咨询。")
        }
        .confirmationDialog("删除历史记录", isPresented: Binding(
            get: { historyItemToDelete != nil },
            set: { if !$0 { historyItemToDelete = nil } }
        )) {
            Button(languageCode == "en" ? "Cancel" : "取消", role: .cancel) { historyItemToDelete = nil }
            Button(languageCode == "en" ? "Delete" : "删除", role: .destructive) {
                if let item = historyItemToDelete {
                    historyVm.deleteItem(item) { success in
                        if success {
                            if homeVm.loadedHistoryId == item.id { homeVm.startNewConversation() }
                        }
                        historyItemToDelete = nil
                    }
                }
            }
        } message: {
            Text(languageCode == "en"
                 ? "Are you sure you want to delete this record? It will no longer be shown and cannot be undone."
                 : "确定删除该条记录，删除后将不再展示，并且无法撤回。")
        }
    }

    private var mainContent: some View {
        NavigationStack {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        if homeVm.turns.isEmpty {
                            // V3-B 首页通知条：未读官方情报时显示
                            HomeIntelBanner()
                                .padding(.horizontal, 16)
                            HomeEmptyStateContent()
                        }
                        ForEach(homeVm.turns) { turn in
                            ChatMessageView(turn: turn)
                                .id(turn.id)
                        }
                    }
                    .padding(.vertical, 12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    // 点击消息列表空白区域收起键盘
                    .contentShape(Rectangle())
                    .onTapGesture { isInputFocused = false }
                }
                .onChange(of: homeVm.turns.count) { _, _ in
                    if let last = homeVm.turns.last {
                        withAnimation(.easeOut(duration: 0.25)) {
                            proxy.scrollTo(last.id, anchor: .bottom)
                        }
                    }
                }
                .onChange(of: homeVm.scrollToTurnId) { _, newId in
                    guard let id = newId else { return }
                    withAnimation(.easeOut(duration: 0.25)) {
                        proxy.scrollTo(id, anchor: .bottom)
                    }
                    homeVm.scrollToTurnId = nil
                }
                .scrollDismissesKeyboard(.interactively)
            }
            .scrollContentBackground(.hidden)
            .background(AppTheme.background)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .safeAreaInset(edge: .bottom, spacing: 0) {
                VStack(spacing: 0) {
                    // 仅在新对话、且输入框无内容时显示；用户输入或已有对话后隐藏
                    if !isInputFocused, homeVm.turns.isEmpty, homeVm.inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        Text(languageCode == "en" ? "Trusted by 10,000+ users" : "受 10,000+ 用户信任")
                            .font(.caption)
                            .foregroundColor(AppTheme.textSecondary)
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding(.horizontal, 20)
                            .padding(.bottom, 6)
                    }
                    AnalyzeInputBar(
                        text: $homeVm.inputText,
                        pendingImage: homeVm.pendingImage,
                        onRemovePendingImage: { homeVm.clearPendingImage() },
                        onSubmit: {
                            if let img = homeVm.pendingImage {
                                let t = homeVm.inputText.trimmingCharacters(in: .whitespacesAndNewlines)
                                if !t.isEmpty { homeVm.analyzeImageAndText(img, text: homeVm.inputText) }
                                else { homeVm.analyzeImage(img) }
                            } else {
                                homeVm.analyze()
                            }
                        },
                        onSendWithImage: { homeVm.analyzeImage($0) },
                        onSendWithImageAndText: { homeVm.analyzeImageAndText($0, text: $1) },
                        onCamera: {
                            showCameraCapture = true
                        },
                        onVoiceToggle: {
                            Task {
                                _ = await SpeechRecognitionService.shared.requestAuthorization()
                            }
                        },
                        onPlus: { showImagePicker = true },
                        onVoiceHoldStart: {
                            voiceHintText = (languageCode == "en" ? "Please speak..." : "请说话......")
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                                if voiceHintText == (languageCode == "en" ? "Please speak..." : "请说话......") {
                                    voiceHintText = (languageCode == "en" ? "Listening..." : "说话中......")
                                }
                            }
                            voiceRecordingTask = Task {
                                let text = try? await SpeechRecognitionService.shared.startRecording()
                                await MainActor.run {
                                    if let t = text, !t.isEmpty {
                                        homeVm.inputText = t
                                        homeVm.analyze()
                                    }
                                    voiceRecordingTask = nil
                                }
                            }
                        },
                        onVoiceHoldEnd: {
                            voiceHintText = (languageCode == "en" ? "Hold to speak" : "按住说话")
                            SpeechRecognitionService.shared.stopRecording()
                        },
                        onVoiceCancel: {
                            // 上滑取消：不解析识别结果，直接放弃整段录音
                            voiceHintText = (languageCode == "en" ? "Hold to speak" : "按住说话")
                            SpeechRecognitionService.shared.stopRecording()
                            voiceRecordingTask?.cancel()
                            voiceRecordingTask = nil
                        },
                        voiceHintText: voiceHintText,
                        isFocused: $isInputFocused
                    )
                    Color.clear.frame(height: isInputFocused ? 12 : 56)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button {
                        showSidebar = true
                    } label: {
                        Image(systemName: "line.3.horizontal")
                            .font(.system(size: 18, weight: .medium))
                            .foregroundColor(AppTheme.primary)
                    }
                    .a11y(
                        label: languageCode == "en" ? "Open menu" : "打开菜单",
                        hint: languageCode == "en" ? "View history and settings" : "查看历史与设置"
                    )
                }
                ToolbarItem(placement: .principal) {
                    Text(languageCode == "en" ? "StarLens AI" : "星识安全助手")
                        .font(.headline)
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        showSidebar = false
                        homeVm.startNewConversation()
                        historyVm.refresh()
                    } label: {
                        Image(systemName: "square.and.pencil")
                            .font(.system(size: 16, weight: .medium))
                            .foregroundColor(AppTheme.primary)
                    }
                    .a11y(
                        label: languageCode == "en" ? "Start new chat" : "开始新对话",
                        hint: languageCode == "en" ? "Clear current conversation" : "清空当前对话"
                    )
                }
            }
        }
        .environmentObject(appState)
        .environmentObject(router)
    }

    private var sidebar: some View {
        HStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 0) {
                // 顶部标题（顶到屏幕顶部，无关闭按钮）
                Text(languageCode == "en" ? "StarLens AI" : "星识安全助手")
                    .font(.headline)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 20)
                    .padding(.top, 16)
                    .padding(.bottom, 12)

                // 新建对话
                Button {
                    showSidebar = false
                    homeVm.startNewConversation()
                    historyVm.refresh()
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "plus.circle.fill")
                        Text(languageCode == "en" ? "New chat" : "新建对话")
                    }
                    .font(.subheadline.weight(.medium))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(AppTheme.primary)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 12)

                // 搜索
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(AppTheme.secondaryText)
                    TextField(languageCode == "en" ? "Search history" : "搜索咨询历史", text: $historySearchText)
                        .textFieldStyle(.plain)
                }
                .padding(12)
                .background(Color(.systemGray6))
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .padding(.horizontal, 20)
                .padding(.bottom, 12)

                // 历史咨询列表（最新在上）；设置入口已隐藏
                VStack(alignment: .leading, spacing: 4) {
                    Text(languageCode == "en" ? "History" : "历史咨询")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(AppTheme.secondaryText)
                        .padding(.horizontal, 20)
                    if !appState.isLoggedIn {
                        Text(languageCode == "en" ? "Log in to view history" : "登录后查看历史记录")
                            .font(.caption)
                            .foregroundStyle(AppTheme.secondaryText)
                            .padding(.horizontal, 20)
                            .padding(.vertical, 12)
                    } else {
                        sidebarHistoryList
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)

                Spacer(minLength: 0)
            }
            .frame(width: sidebarWidth)
            .background(AppTheme.background)
            // 不忽略顶部安全区，避免遮挡状态栏

            Spacer(minLength: 0)
        }
        .onAppear {
            historyVm.refresh()
        }
    }

    private var sidebarHistoryList: some View {
        let localRecord = LocalDefaultQAStore.shared.defaultConversationRecord

        // 服务器历史（按搜索过滤后）；
        // 若本地默认会话已拿到 serverConversationId，则过滤掉服务端同一会话，避免重复。
        var serverList = historySearchText.isEmpty
            ? historyVm.items
            : historyVm.items.filter { $0.content.localizedCaseInsensitiveContains(historySearchText) }
        if let localServerId = localRecord?.serverConversationId, !localServerId.isEmpty {
            serverList = serverList.filter { $0.id != localServerId && $0.conversationId != localServerId }
        }
        let sortedServer = serverList.sorted { (a, b) in (a.createdAt ?? "") > (b.createdAt ?? "") }
        let (todayItems, earlierItems) = Self.groupByTodayAndEarlier(sortedServer)

        // 本地默认会话分组（今天/更早）
        let localTitle = localDefaultConversationTitle()
        let localMatchesSearch = historySearchText.isEmpty || localTitle.localizedCaseInsensitiveContains(historySearchText)
        let calendar = Calendar.current
        let todayStart = calendar.startOfDay(for: Date())
        let localDate = localRecord.flatMap { Formatter.isoDate($0.createdAtISO) }
        let localIsToday = localDate.map { calendar.isDate($0, inSameDayAs: todayStart) } ?? false
        let localTodayRecord = (localRecord != nil && localMatchesSearch && localIsToday) ? localRecord : nil
        let localEarlierRecord = (localRecord != nil && localMatchesSearch && !localIsToday) ? localRecord : nil

        return ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                if historyVm.state.isLoading && historyVm.items.isEmpty && localRecord == nil {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding()
                } else {
                    if homeVm.loadedHistoryId == nil {
                        HStack(spacing: 8) {
                            Button {
                                showSidebar = false
                            } label: {
                                Text(homeVm.currentConversationTitle)
                                    .font(.subheadline)
                                    .foregroundColor(.primary)
                                    .lineLimit(1)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(.vertical, 10)
                        .padding(.horizontal, 4)
                    }
                    if !todayItems.isEmpty || localTodayRecord != nil {
                        sectionHeader(languageCode == "en" ? "Today" : "今天")
                        if let rec = localTodayRecord {
                            sidebarLocalDefaultConversationRow(record: rec)
                        }
                        ForEach(todayItems, id: \.id) { item in
                            sidebarHistoryRow(item: item)
                        }
                    }
                    if !earlierItems.isEmpty || localEarlierRecord != nil {
                        sectionHeader(languageCode == "en" ? "Earlier" : "更早")
                        if let rec = localEarlierRecord {
                            sidebarLocalDefaultConversationRow(record: rec)
                        }
                        ForEach(earlierItems, id: \.id) { item in
                            sidebarHistoryRow(item: item)
                        }
                    }
                    if (homeVm.loadedHistoryId != nil || !homeVm.turns.isEmpty)
                        && todayItems.isEmpty && earlierItems.isEmpty
                        && localTodayRecord == nil && localEarlierRecord == nil {
                        Text(languageCode == "en" ? "No records" : "暂无记录")
                            .font(.caption)
                            .foregroundStyle(AppTheme.secondaryText)
                            .frame(maxWidth: .infinity)
                            .padding()
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 24)
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            Color.clear.frame(height: 88)
        }
    }

    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .font(.caption.weight(.semibold))
            .foregroundStyle(AppTheme.secondaryText)
            .padding(.horizontal, 4)
            .padding(.top, 12)
            .padding(.bottom, 4)
    }

    private func sidebarHistoryRow(item: QueryHistoryItem) -> some View {
        HStack(spacing: 8) {
            Button {
                homeVm.loadHistoryItem(item)
                showSidebar = false
            } label: {
                Text(HistoryTitleHelper.title(for: item))
                    .font(.subheadline)
                    .foregroundColor(.primary)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.plain)
            Button {
                historyItemToDelete = item
            } label: {
                Image(systemName: "trash")
                    .font(.system(size: 14))
                    .foregroundColor(AppTheme.secondaryText)
            }
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 4)
    }

    private func sidebarLocalDefaultConversationRow(record: LocalDefaultConversationRecord) -> some View {
        HStack(spacing: 8) {
            Button {
                homeVm.loadLocalDefaultConversation(record, languageCode: languageCode)
                showSidebar = false
            } label: {
                Text(localDefaultConversationTitle())
                    .font(.subheadline)
                    .foregroundColor(.primary)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.plain)

            Button {
                LocalDefaultQAStore.shared.clearDefaultConversationRecord()
                if homeVm.loadedHistoryId == record.localConversationId {
                    homeVm.startNewConversation()
                    historyVm.refresh()
                }
            } label: {
                Image(systemName: "trash")
                    .font(.system(size: 14))
                    .foregroundColor(AppTheme.secondaryText)
            }
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 4)
    }

    private static func groupByTodayAndEarlier(_ items: [QueryHistoryItem]) -> (today: [QueryHistoryItem], earlier: [QueryHistoryItem]) {
        let calendar = Calendar.current
        let todayStart = calendar.startOfDay(for: Date())
        var today: [QueryHistoryItem] = []
        var earlier: [QueryHistoryItem] = []
        for item in items {
            guard let date = Formatter.isoDate(item.createdAt) else {
                earlier.append(item)
                continue
            }
            if calendar.isDate(date, inSameDayAs: todayStart) {
                today.append(item)
            } else {
                earlier.append(item)
            }
        }
        return (today, earlier)
    }
}

private struct ConfirmPhotoItem: Identifiable {
    let id = UUID()
    let image: UIImage
}

// 加号菜单：相机 + 相册 在顶部，下方为最近照片；关闭按钮已隐藏，靠下拉关闭
private struct MediaPickerSheet: View {
    var onCamera: () -> Void
    var onPhotoLibrary: () -> Void
    var onDeepfake: () -> Void = {}
    var onSelectRecent: (UIImage) -> Void

    @AppStorage("isitsafe.language") private var languageCode: String = "zh"

    var body: some View {
        VStack(spacing: 10) {
            HStack(spacing: 12) {
                Button { onCamera() } label: {
                    VStack(spacing: 6) {
                        Image(systemName: "camera.fill")
                            .font(.system(size: 24))
                            .foregroundColor(AppTheme.primary)
                        Text(languageCode == "en" ? "Camera" : "相机")
                            .font(.caption)
                            .foregroundColor(.primary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Color(.systemGray6))
                    .cornerRadius(12)
                }
                .buttonStyle(.plain)

                Button { onPhotoLibrary() } label: {
                    VStack(spacing: 6) {
                        Image(systemName: "photo.on.rectangle.angled")
                            .font(.system(size: 24))
                            .foregroundColor(AppTheme.primary)
                        Text(languageCode == "en" ? "Photos" : "相册")
                            .font(.caption)
                            .foregroundColor(.primary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Color(.systemGray6))
                    .cornerRadius(12)
                }
                .buttonStyle(.plain)

                // V3-A1 入口
                Button { onDeepfake() } label: {
                    VStack(spacing: 6) {
                        Image(systemName: "mic.fill")
                            .font(.system(size: 24))
                            .foregroundColor(.white)
                        Text(languageCode == "en" ? "Voice AI" : "语音深伪")
                            .font(.caption.weight(.semibold))
                            .foregroundColor(.white)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(
                        LinearGradient(colors: [AppTheme.primary, AppTheme.premiumHeader],
                                       startPoint: .topLeading, endPoint: .bottomTrailing)
                    )
                    .cornerRadius(12)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal)

            Text(languageCode == "en" ? "Recent photos" : "最近照片")
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundColor(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 4)

            RecentPhotosView(onSelect: onSelectRecent)
                .frame(maxHeight: .infinity)
        }
        .padding(.top, 8)
        .padding(.bottom, 12)
    }
}
