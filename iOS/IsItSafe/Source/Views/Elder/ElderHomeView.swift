//
//  ElderHomeView.swift
//  IsItSafe
//
//  V3-J 长辈模式首页（V3-J 更新版：保留输入框 + 新增 2 大快捷入口）
//
//  布局：
//   - 顶部：紧凑问候条（昵称 + 当前日期）
//   - 中上：2 个超大按钮（这是不是骗子 / 给孩子打电话）
//   - 中部：聊天结果区（vm.turns / vm.lastResult），随用户输入实时滚动
//   - 底部：AnalyzeInputBar（与普通首页同一组件）
//
//  设计意图：
//   - 长辈遇到具体可疑事件 → 点 2 个大按钮快速进入向导
//   - 长辈想直接问 AI → 用底部输入框（文字、拍照、按住说话）
//

import Combine
import SwiftUI
import UIKit

public struct ElderHomeView: View {
    @EnvironmentObject private var appState: AppStateViewModel
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"

    @StateObject private var vm = HomeViewModel()
    @FocusState private var isInputFocused: Bool

    @State private var showDetection = false
    @State private var showSOS = false
    @State private var showCamera = false
    @State private var voiceTask: Task<Void, Never>?
    @State private var isRecordingVoice = false
    @State private var errorMessage: String?

    public init() {}

    public var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                compactGreeting
                quickButtons
                chatResultsArea
                inputBar
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
            // 检测页请求"立刻打孩子电话" → 弹 SOS 拨号
            .onReceive(NotificationCenter.default.publisher(for: .elderRequestCallGuardian)) { _ in
                showDetection = false
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    showSOS = true
                }
            }
        }
    }

    // MARK: - 顶部紧凑问候

    private var compactGreeting: some View {
        HStack(spacing: 14) {
            // 头像
            ZStack {
                Circle()
                    .fill(LinearGradient(colors: [AppTheme.primary.opacity(0.75), AppTheme.primary],
                                         startPoint: .topLeading,
                                         endPoint: .bottomTrailing))
                    .frame(width: 52, height: 52)
                Text(String(displayName.prefix(1)))
                    .font(.system(size: 22, weight: .bold))
                    .foregroundColor(.white)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(greetingText)
                    .font(.system(size: 22, weight: .bold))
                    .foregroundColor(AppTheme.textPrimary)
                Text(dateText)
                    .font(.system(size: 14))
                    .foregroundColor(AppTheme.textSecondary)
            }
            Spacer()
        }
        .padding(.horizontal, 18)
        .padding(.top, 14)
        .padding(.bottom, 14)
        .background(AppTheme.cardBackground)
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
                Text(icon).font(.system(size: 30))
                Text(title)
                    .font(.system(size: 22, weight: .bold))
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(.white.opacity(0.85))
            }
            .foregroundColor(.white)
            .frame(maxWidth: .infinity, minHeight: 68)
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
                    if vm.state.isLoading {
                        HStack(spacing: 10) {
                            ProgressView()
                            Text(languageCode == "en" ? "AI is checking..." : "AI 正在帮您判断...")
                                .font(.system(size: 18))
                                .foregroundColor(AppTheme.textSecondary)
                        }
                        .padding(16)
                        .id("loading")
                    }
                }
                .padding(.horizontal, 18)
                .padding(.vertical, 12)
            }
            .background(AppTheme.background)
            .dynamicTypeSize(.xLarge)
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
                .font(.system(size: 44))
            Text(languageCode == "en"
                 ? "Tap a big button above, or type what you want to check below"
                 : "上面有两个大按钮，也可以在下方输入您想问的事情")
                .font(.system(size: 17))
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
                        .font(.system(size: 18))
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
                        .font(.system(size: 16))
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
                        .font(.system(size: 16))
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

    // MARK: - 辅助

    private var displayName: String {
        if let nick = appState.user?.wechatNickname, !nick.isEmpty { return nick }
        if let nick = appState.user?.nickname, !nick.isEmpty { return nick }
        return languageCode == "en" ? "Friend" : "您"
    }

    private var greetingText: String {
        if languageCode == "en" { return "Hello, \(displayName)" }
        return "您好，\(displayName)"
    }

    private var dateText: String {
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: languageCode == "en" ? "en_US" : "zh_CN")
        fmt.dateFormat = languageCode == "en" ? "EEEE, MMM d" : "M 月 d 日 EEEE"
        return fmt.string(from: Date())
    }
}
