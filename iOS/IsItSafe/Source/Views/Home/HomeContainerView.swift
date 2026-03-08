//
//  HomeContainerView.swift
//  IsItSafe
//
//  首页容器：顶部栏、侧滑抽屉（历史/搜索/设置/新建对话）、主内容、输入栏。
//

import SwiftUI
import UIKit

public struct HomeContainerView: View {
    @StateObject private var homeVm = HomeViewModel()
    @StateObject private var historyVm = HistoryViewModel()
    @FocusState private var isInputFocused: Bool
    @State private var showSidebar = false
    @State private var showScreenshotSheet = false
    @State private var screenshotOCRText = ""
    @State private var showImagePicker = false
    @State private var showPhotoLibrary = false
    @State private var showCameraCapture = false
    @State private var showConfirmPhoto = false
    @State private var capturedImageForConfirm: UIImage?
    @State private var showClipboardAlert = false
    @State private var previousScenePhase: ScenePhase?
    @State private var showSettings = false
    @State private var historySearchText = ""
    @State private var selectedHistoryItem: QueryHistoryItem?
    @State private var historyItemToDelete: QueryHistoryItem?
    @State private var voiceRecordingTask: Task<Void, Never>?
    @EnvironmentObject private var appState: AppStateViewModel
    @EnvironmentObject private var router: AppRouter
    @Environment(\.scenePhase) private var scenePhase

    public init() {}

    /// 冷启动剪贴板只弹一次：底导切回首页会再次 onAppear，用此标记区分
    private static var hasDoneColdStartClipboardCheck = false

    private let sidebarWidth = min(320, UIScreen.main.bounds.width * 0.85)

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
        }
        .sheet(isPresented: $showImagePicker) {
            ImagePickerSheet(onCamera: {
                showImagePicker = false
                showCameraCapture = true
            }, onPhotoLibrary: {
                showImagePicker = false
                showPhotoLibrary = true
            })
        }
        .sheet(isPresented: $showPhotoLibrary) {
            PhotoLibraryPicker { data in
                if let data = data, let img = UIImage(data: data) {
                    homeVm.pendingImage = img
                }
                showPhotoLibrary = false
            }
        }
        .fullScreenCover(isPresented: $showCameraCapture) {
            CameraCaptureView(
                onImage: { img in
                    showCameraCapture = false
                    capturedImageForConfirm = img
                    showConfirmPhoto = true
                },
                onCancel: { showCameraCapture = false }
            )
        }
        .sheet(isPresented: $showConfirmPhoto) {
            if let img = capturedImageForConfirm {
                ConfirmPhotoSheet(image: img) {
                    homeVm.pendingImage = img
                    capturedImageForConfirm = nil
                }
            }
        }
        .alert("剪贴板", isPresented: $showClipboardAlert) {
            Button("允许") {
                if let str = UIPasteboard.general.string, !str.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    homeVm.inputText = str
                    isInputFocused = true
                }
            }
            Button("不允许", role: .cancel) { }
        } message: {
            Text("是否将剪贴板内容填入输入框？")
        }
        .onChange(of: scenePhase) { _, newPhase in
            let cameFromBackground = (previousScenePhase == .background)
            previousScenePhase = newPhase
            if newPhase == .active, cameFromBackground,
               let str = UIPasteboard.general.string, !str.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                showClipboardAlert = true
            }
        }
        .onAppear {
            if previousScenePhase == nil {
                previousScenePhase = scenePhase
                if !Self.hasDoneColdStartClipboardCheck {
                    Self.hasDoneColdStartClipboardCheck = true
                    if let str = UIPasteboard.general.string, !str.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        showClipboardAlert = true
                    }
                }
            }
        }
        .navigationDestination(item: $selectedHistoryItem) { item in
            HistoryDetailView(item: item)
        }
        .onChange(of: homeVm.turns.count) { _, newCount in
            if newCount > 0 { historyVm.refresh() }
        }
        .onChange(of: homeVm.historyRefreshTrigger) { _, _ in
            historyVm.refresh()
        }
        .confirmationDialog("删除历史记录", isPresented: Binding(
            get: { historyItemToDelete != nil },
            set: { if !$0 { historyItemToDelete = nil } }
        )) {
            Button("取消", role: .cancel) { historyItemToDelete = nil }
            Button("删除", role: .destructive) {
                if let item = historyItemToDelete {
                    historyVm.deleteItem(item) { success in
                        if success, homeVm.loadedHistoryId == item.id { homeVm.startNewConversation() }
                        historyItemToDelete = nil
                    }
                }
            }
        } message: {
            Text("确定删除该条记录，删除后将不再展示，并且无法撤回。")
        }
    }

    private var mainContent: some View {
        NavigationStack {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        if homeVm.turns.isEmpty {
                            HomeEmptyStateContent()
                        }
                        ForEach(homeVm.turns) { turn in
                            ChatMessageView(turn: turn)
                                .id(turn.id)
                        }
                    }
                    .padding(.vertical, 12)
                    .frame(maxWidth: .infinity, alignment: .leading)
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
            }
            .scrollContentBackground(.hidden)
            .background(AppTheme.background)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .safeAreaInset(edge: .bottom, spacing: 0) {
                VStack(spacing: 0) {
                    AnalyzeInputBar(
                        text: $homeVm.inputText,
                        pendingImage: homeVm.pendingImage,
                        onRemovePendingImage: { homeVm.clearPendingImage() },
                        onSubmit: { homeVm.analyze() },
                        onSendWithImage: { homeVm.analyzeImage($0) },
                        onSendWithImageAndText: { homeVm.analyzeImageAndText($0, text: $1) },
                        onCamera: {
                            // 左侧相机：直接打开相机拍摄
                            showCameraCapture = true
                        },
                        onVoiceToggle: {
                            Task {
                                _ = await SpeechRecognitionService.shared.requestAuthorization()
                            }
                        },
                        onPlus: { showImagePicker = true },
                        onVoiceHoldStart: {
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
                            SpeechRecognitionService.shared.stopRecording()
                        },
                        isFocused: $isInputFocused
                    )
                    Color.clear.frame(height: 56)
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
                            .foregroundColor(.primary)
                    }
                }
                ToolbarItem(placement: .principal) {
                    Text("防骗助手")
                        .font(.headline)
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        showSidebar = false
                        homeVm.startNewConversation()
                    } label: {
                        Image(systemName: "square.and.pencil")
                            .font(.system(size: 16, weight: .medium))
                            .foregroundColor(AppTheme.primary)
                    }
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
                Text("防骗助手")
                    .font(.headline)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 20)
                    .padding(.top, 16)
                    .padding(.bottom, 12)

                // 新建对话
                Button {
                    showSidebar = false
                    homeVm.startNewConversation()
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "plus.circle.fill")
                        Text("新建对话")
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
                    TextField("搜索咨询历史", text: $historySearchText)
                        .textFieldStyle(.plain)
                }
                .padding(12)
                .background(Color(.systemGray6))
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .padding(.horizontal, 20)
                .padding(.bottom, 12)

                // 历史咨询列表（最新在上）；设置入口已隐藏
                VStack(alignment: .leading, spacing: 4) {
                    Text("历史咨询")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(AppTheme.secondaryText)
                        .padding(.horizontal, 20)
                    if !appState.isLoggedIn {
                        Text("登录后查看历史记录")
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
        let list = historySearchText.isEmpty
            ? historyVm.items
            : historyVm.items.filter { $0.content.localizedCaseInsensitiveContains(historySearchText) }
        let sorted = list.sorted { (a, b) in (a.createdAt ?? "") > (b.createdAt ?? "") }
        let (todayItems, earlierItems) = Self.groupByTodayAndEarlier(sorted)
        let showCurrentPlaceholder = homeVm.turns.isEmpty && homeVm.loadedHistoryId == nil

        return ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                if historyVm.state.isLoading && historyVm.items.isEmpty {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding()
                } else {
                    if showCurrentPlaceholder {
                        HStack(spacing: 8) {
                            Text("新对话")
                                .font(.subheadline)
                                .foregroundColor(AppTheme.secondaryText)
                                .lineLimit(1)
                            Spacer(minLength: 0)
                        }
                        .padding(.vertical, 10)
                        .padding(.horizontal, 4)
                    }
                    if !todayItems.isEmpty {
                        sectionHeader("今天")
                        ForEach(todayItems, id: \.id) { item in
                            sidebarHistoryRow(item: item)
                        }
                    }
                    if !earlierItems.isEmpty {
                        sectionHeader("更早")
                        ForEach(earlierItems, id: \.id) { item in
                            sidebarHistoryRow(item: item)
                        }
                    }
                    if !showCurrentPlaceholder && todayItems.isEmpty && earlierItems.isEmpty {
                        Text("暂无记录")
                            .font(.caption)
                            .foregroundStyle(AppTheme.secondaryText)
                            .frame(maxWidth: .infinity)
                            .padding()
                    }
                }
            }
            .padding(.horizontal, 20)
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

// 加号菜单：相机 / 相册 / 所有照片
private struct ImagePickerSheet: View {
    var onCamera: () -> Void
    var onPhotoLibrary: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Button("相机") { onCamera() }
                .frame(maxWidth: .infinity)
                .padding()
            Button("相册") { onPhotoLibrary() }
                .frame(maxWidth: .infinity)
                .padding()
            Button("所有照片", action: onPhotoLibrary)
                .frame(maxWidth: .infinity)
                .padding()
        }
        .padding()
    }
}
