//
//  ElderHomeView.swift
//  IsItSafe
//
//  V3-J 长辈模式首页（V4 简化：去掉冗余问候条，与普通模式共用聊天区/输入框模式）
//
//  布局：
//   - 中上：2 个超大按钮（这是不是骗子 / 给孩子打电话）
//   - 中部：聊天结果区（vm.turns / vm.lastResult），随用户输入实时滚动
//   - 底部：AnalyzeInputBar（与普通首页同一组件）
//
//  设计意图：
//   - 长辈遇到具体可疑事件 → 点 2 个大按钮快速进入向导
//   - 长辈想直接问 AI → 用底部输入框（文字、拍照、按住说话）
//
//  V4 业主复核：
//   - 删掉头部"您好，您 + 日期" — 信息冗余且占空间
//   - 字号整体放大约 1.5×；同时套 .dynamicTypeSize(.accessibility3) 让
//     AnalyzeInputBar 等共用组件里的 dynamic font 同步放大
//   - 键盘可点击空白处/下拉滚动收起，工具栏右上角加"完成"按钮兜底

import Combine
import SwiftUI
import UIKit

public struct ElderHomeView: View {
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"

    @StateObject private var vm = HomeViewModel()
    @FocusState private var isInputFocused: Bool

    @State private var showDetection = false
    @State private var showSOS = false
    @State private var showCamera = false
    @State private var showPremiumSheet = false
    @State private var voiceTask: Task<Void, Never>?
    @State private var isRecordingVoice = false
    @State private var errorMessage: String?
    /// 看门狗：超过 45s 的 analyzing 状态强制失败，避免 UI 永远卡死
    @State private var watchdogTask: Task<Void, Never>?

    /// 长辈模式字体倍率：与"放大一倍"诉求平衡布局（部分文本本来就大，×2 会破坏布局）
    private let elderScale: CGFloat = 1.5

    public init() {}

    public var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                quickButtons
                chatResultsArea
            }
            // 共用组件（AnalyzeInputBar 等）里的 .body/.subheadline/.caption 这些 dynamic font
            // 会跟着 dynamicTypeSize 放大；本文件里手写的 .system(size:) 已手动 × elderScale
            .dynamicTypeSize(.accessibility3)
            // 用 safeAreaInset 把 inputBar 固定在底部，跟 HomeContainerView 同
            // pattern；之前直接放在 VStack 末尾会被 MainTabView 自定义 tabBar
            // (~88pt) 完全挡住
            .safeAreaInset(edge: .bottom, spacing: 0) {
                VStack(spacing: 0) {
                    inputBar
                    // 让 inputBar 浮在 tabBar 上方 ~88pt 高度位置
                    Color.clear.frame(height: 88)
                }
            }
            .background(AppTheme.background.ignoresSafeArea())
            .navigationBarHidden(true)
            .fullScreenCover(isPresented: $showDetection) {
                ElderDetectionView()
            }
            .fullScreenCover(isPresented: $showSOS) {
                ElderSOSView()
            }
            .sheet(isPresented: $showCamera) {
                CameraCaptureView(
                    onImage: { img in
                        showCamera = false
                        vm.analyzeImage(img)
                    },
                    onCancel: { showCamera = false }
                )
                .ignoresSafeArea()
            }
            .alert(
                languageCode == "en" ? "Sorry" : "提示",
                isPresented: Binding(
                    get: { errorMessage != nil },
                    set: { if !$0 { errorMessage = nil } }
                ),
                actions: { Button(languageCode == "en" ? "OK" : "知道了") { errorMessage = nil } },
                message: { Text(errorMessage ?? "") }
            )
            // 今日免费次数用完
            .alert(
                languageCode == "en" ? "Daily Limit Reached" : "今日额度已用完",
                isPresented: $vm.showDailyQuotaAlert
            ) {
                Button(languageCode == "en" ? "Subscribe Now" : "立即订阅") {
                    showPremiumSheet = true
                }
                Button(languageCode == "en" ? "Later" : "稍后再说", role: .cancel) {}
            } message: {
                let limit = AppSettingsStore.maxFreeQueriesPerDay
                Text(languageCode == "en"
                     ? "You've used all \(limit) free analyses today. Subscribe to unlock unlimited."
                     : "您今天的 \(limit) 次免费分析已用完，开通会员可不限次使用")
            }
            .sheet(isPresented: $showPremiumSheet) {
                NavigationStack { PremiumSubscriptionView() }
            }
            // 看门狗：监听 turns 变化，超过 45s 还卡在 .analyzing 就强制结束
            .onChange(of: vm.turns.count) { _, _ in
                installWatchdogIfNeeded()
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

    /// 看门狗：最后一个 turn 仍在 analyzing 状态超过 45s，认为请求挂死，
    /// 强制把它替换成 failure 状态，让用户能继续操作并知道发生了什么
    private func installWatchdogIfNeeded() {
        guard let last = vm.turns.last, case .analyzing = last.status else {
            watchdogTask?.cancel()
            watchdogTask = nil
            return
        }
        watchdogTask?.cancel()
        let watchTurnId = last.id
        watchdogTask = Task {
            try? await Task.sleep(nanoseconds: 45_000_000_000)
            if Task.isCancelled { return }
            await MainActor.run {
                guard let idx = vm.turns.firstIndex(where: { $0.id == watchTurnId }) else { return }
                if case .analyzing = vm.turns[idx].status {
                    let msg = languageCode == "en"
                        ? "Network is slow. Please check your connection and try again."
                        : "网络不太好，请检查后再试一次"
                    let t = vm.turns[idx]
                    vm.turns[idx] = ChatTurn(
                        id: t.id, userText: t.userText, userImage: t.userImage,
                        imageUrl: t.imageUrl, status: .done(.failure(msg))
                    )
                    print("[ElderHomeView] watchdog: forced .failure for stuck turn after 45s")
                }
            }
        }
    }

    // MARK: - 2 个大按钮

    private var quickButtons: some View {
        VStack(spacing: 12) {
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
        }
        .padding(.horizontal, 18)
        .padding(.top, 14)
        .padding(.bottom, 12)
    }

    @ViewBuilder
    private func bigButton(icon: String, title: String, bg: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Text(icon).font(.system(size: 30 * elderScale))
                Text(title)
                    .font(.system(size: 22 * elderScale, weight: .bold))
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 16 * elderScale, weight: .bold))
                    .foregroundColor(.white.opacity(0.85))
            }
            .foregroundColor(.white)
            .frame(maxWidth: .infinity, minHeight: 68 * elderScale)
            .padding(.horizontal, 18)
            .background(bg)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .shadow(color: bg.opacity(0.25), radius: 6, x: 0, y: 3)
        }
    }

    // MARK: - 聊天结果区

    @ViewBuilder
    private var chatResultsArea: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 12) {
                    if vm.turns.isEmpty {
                        emptyHint
                            .padding(.top, 20)
                    } else {
                        ForEach(vm.turns) { turn in
                            chatTurnRow(turn)
                                .id(turn.id)
                        }
                    }
                }
                .padding(.horizontal, 18)
                .padding(.vertical, 12)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(AppTheme.background)
            // V4 业主反馈"长辈模式键盘无法隐藏"：交互式下拉收键盘 + 工具栏 Done 按钮
            .scrollDismissesKeyboard(.interactively)
            // 点空白处收键盘（不影响按钮交互，因为按钮自带 hit-test 优先）
            .contentShape(Rectangle())
            .onTapGesture { isInputFocused = false }
            .toolbar {
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button(languageCode == "en" ? "Done" : "完成") {
                        isInputFocused = false
                    }
                }
            }
            .onChange(of: vm.turns.count) { _, _ in
                withAnimation {
                    if let lastId = vm.turns.last?.id {
                        proxy.scrollTo(lastId, anchor: .bottom)
                    }
                }
            }
        }
    }

    private var emptyHint: some View {
        VStack(spacing: 10) {
            Text("💡")
                .font(.system(size: 44 * elderScale))
            Text(languageCode == "en"
                 ? "Tap a big button above, or type what you want to check below"
                 : "上面有两个大按钮，也可以在下方输入您想问的事情")
                .font(.system(size: 17 * elderScale))
                .foregroundColor(AppTheme.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 8)
    }

    @ViewBuilder
    private func chatTurnRow(_ turn: ChatTurn) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            if let userText = turn.userText, !userText.isEmpty {
                HStack {
                    Spacer(minLength: 40)
                    Text(userText)
                        .font(.system(size: 18 * elderScale))
                        .foregroundColor(.white)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(AppTheme.primary)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
            }
            if let img = turn.userImage {
                HStack {
                    Spacer(minLength: 40)
                    Image(uiImage: img)
                        .resizable()
                        .scaledToFit()
                        .frame(maxWidth: 200, maxHeight: 200)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
            }
            switch turn.status {
            case .analyzing:
                HStack(spacing: 8) {
                    ProgressView()
                    Text(languageCode == "en" ? "Checking..." : "正在判断...")
                        .font(.system(size: 16 * elderScale))
                        .foregroundColor(AppTheme.textSecondary)
                }
            case .done(let result):
                switch result {
                case .analysis(let data):
                    RiskResultCard(data: data)
                case .query(let res):
                    QueryRiskCard(response: res)
                case .failure(let msg):
                    Text(msg)
                        .font(.system(size: 16 * elderScale))
                        .foregroundColor(AppTheme.riskHigh)
                }
            }
        }
    }

    // MARK: - 底部输入框

    private var inputBar: some View {
        AnalyzeInputBar(
            text: $vm.inputText,
            pendingImage: vm.pendingImage,
            onRemovePendingImage: { vm.clearPendingImage() },
            onSubmit: {
                if let img = vm.pendingImage {
                    let txt = vm.inputText.trimmingCharacters(in: .whitespacesAndNewlines)
                    if txt.isEmpty {
                        vm.analyzeImage(img)
                    } else {
                        vm.analyzeImageAndText(img, text: txt)
                    }
                } else {
                    vm.analyze()
                }
            },
            onSendWithImage: { vm.analyzeImage($0) },
            onSendWithImageAndText: { vm.analyzeImageAndText($0, text: $1) },
            onCamera: { showCamera = true },
            onVoiceToggle: { },
            onPlus: { showCamera = true },
            onVoiceHoldStart: { startVoiceRecording() },
            onVoiceHoldEnd: { endVoiceRecording(cancelled: false) },
            onVoiceCancel: { endVoiceRecording(cancelled: true) },
            voiceHintText: isRecordingVoice
                ? (languageCode == "en" ? "Listening..." : "请说话...")
                : (languageCode == "en" ? "Hold to speak" : "按住说话"),
            isFocused: $isInputFocused
        )
        .background(AppTheme.cardBackground)
    }

    private func startVoiceRecording() {
        guard !isRecordingVoice else { return }
        voiceTask?.cancel()
        voiceTask = Task {
            let granted = await SpeechRecognitionService.shared.requestAuthorization()
            guard granted else {
                await MainActor.run {
                    errorMessage = languageCode == "en"
                        ? "Microphone permission denied. Please enable in Settings."
                        : "没有麦克风权限，请到系统设置里打开"
                }
                return
            }
            await MainActor.run { isRecordingVoice = true }
            do {
                let text = try await SpeechRecognitionService.shared.startRecording()
                await MainActor.run {
                    isRecordingVoice = false
                    let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
                    if t.isEmpty {
                        // 静默忽略，不打扰长辈
                        return
                    }
                    if let img = vm.pendingImage {
                        vm.analyzeImageAndText(img, text: t)
                    } else {
                        vm.inputText = t
                        vm.analyze()
                    }
                }
            } catch {
                await MainActor.run {
                    isRecordingVoice = false
                    errorMessage = error.localizedDescription
                }
            }
        }
    }

    private func endVoiceRecording(cancelled: Bool) {
        SpeechRecognitionService.shared.stopRecording()
        if cancelled {
            voiceTask?.cancel()
            voiceTask = nil
            isRecordingVoice = false
        }
        // 非取消的话 startRecording 会自动 resume 并触发分析
    }

}
