//
//  ElderDetectionView.swift
//  IsItSafe
//
//  V3-J 长辈检测入口（J-P2 + J-P3 结果页合一）
//  2 种输入方式（接通真实能力，不再 stub）：
//   1. 拍照检测 → CameraCaptureView → Vision OCR → AI 分析
//   2. 说一下   → SpeechRecognitionService 录音转文字 → AI 分析
//   （录音上传入口给长辈太复杂，已隐藏；如需可走"我的 → 语音深伪检测"）
//  结果用大圆环 + TTS 自动朗读
//
//  长辈模式字体全部放大（24-32pt 范围）
//

import Combine
import SwiftUI
import UIKit

public struct ElderDetectionView: View {
    @Environment(\.dismiss) private var dismiss
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    @StateObject private var vm = HomeViewModel()
    @StateObject private var tts = TTSService.shared

    // 输入相关
    @State private var showCamera = false
    @State private var isRecordingVoice = false
    @State private var voiceTask: Task<Void, Never>?

    // 处理中状态（覆盖输入页）
    @State private var isProcessing = false
    @State private var processingMessage = ""

    // 结果状态
    @State private var resultText: String?
    @State private var resultLabel: ResultLabel?
    @State private var errorMessage: String?

    // 监听 vm.lastResult 用
    @State private var cancellables: Set<AnyCancellable> = []
    /// 看门狗：等结果 > 45s 自动 fail
    @State private var watchdogTask: Task<Void, Never>?

    public init() {}

    public enum ResultLabel {
        case high, medium, low

        var color: Color {
            switch self {
            case .high: return AppTheme.riskHigh
            case .medium: return AppTheme.riskMedium
            case .low: return AppTheme.riskLow
            }
        }

        var displayName: String {
            switch self {
            case .high: return "高危"
            case .medium: return "可疑"
            case .low: return "安全"
            }
        }
    }

    public var body: some View {
        NavigationStack {
            ZStack {
                AppTheme.background.ignoresSafeArea()
                if resultText == nil {
                    inputView
                } else {
                    resultView
                }

                if isProcessing {
                    processingOverlay
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button {
                        cancelAnything()
                        dismiss()
                    } label: {
                        HStack {
                            Image(systemName: "chevron.left").font(.system(size: 22, weight: .semibold))
                            Text(languageCode == "en" ? "Back" : "返回")
                                .font(.system(size: 20))
                        }.foregroundColor(AppTheme.primary)
                    }
                }
                ToolbarItem(placement: .principal) {
                    Text(resultText == nil
                         ? (languageCode == "en" ? "Check it" : "检测一下")
                         : (languageCode == "en" ? "Result" : "检测结果"))
                        .font(.system(size: 22, weight: .semibold))
                }
            }
            .sheet(isPresented: $showCamera) {
                CameraCaptureView(
                    onImage: { img in
                        showCamera = false
                        handleCapturedImage(img)
                    },
                    onCancel: { showCamera = false }
                )
                .ignoresSafeArea()
            }
            .alert(
                languageCode == "en" ? "Failed" : "失败",
                isPresented: Binding(
                    get: { errorMessage != nil },
                    set: { if !$0 { errorMessage = nil } }
                ),
                actions: { Button(languageCode == "en" ? "OK" : "知道了") { errorMessage = nil } },
                message: { Text(errorMessage ?? "") }
            )
            .onAppear { observeAIResult() }
        }
    }

    // MARK: - 输入页（J-P2）

    private var inputView: some View {
        ScrollView {
            VStack(spacing: 18) {
                Text(languageCode == "en"
                     ? "Pick one, I'll check for you"
                     : "选一个方法，让我帮您看看")
                    .font(.system(size: 20))
                    .foregroundColor(AppTheme.textSecondary)
                    .padding(.top, 8)

                inputCard(
                    icon: "📷",
                    title: languageCode == "en" ? "Take a photo" : "拍照检测",
                    desc: languageCode == "en"
                        ? "Snap suspicious SMS / link / ad"
                        : "拍一下可疑的短信、链接、广告",
                    primary: true,
                    action: {
                        showCamera = true
                    }
                )

                inputCard(
                    icon: isRecordingVoice ? "⏺" : "🎤",
                    title: isRecordingVoice
                        ? (languageCode == "en" ? "Tap to stop" : "再次点击停止")
                        : (languageCode == "en" ? "Speak it" : "说一下"),
                    desc: isRecordingVoice
                        ? (languageCode == "en" ? "Listening to you..." : "正在听您说，说完后请再点一下")
                        : (languageCode == "en" ? "Tell me what they said on the phone" : "把对方电话里说的话告诉我"),
                    primary: false,
                    highlight: isRecordingVoice,
                    action: {
                        if isRecordingVoice {
                            stopVoiceCapture()
                        } else {
                            startVoiceCapture()
                        }
                    }
                )

            }
            .padding(.horizontal, 18)
            .padding(.bottom, 24)
        }
    }

    private func inputCard(icon: String, title: String, desc: String, primary: Bool, highlight: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 10) {
                Text(icon).font(.system(size: 60))
                Text(title)
                    .font(.system(size: 26, weight: .bold))
                    .foregroundColor(highlight ? .white : (primary ? AppTheme.primary : AppTheme.textPrimary))
                    .multilineTextAlignment(.center)
                Text(desc)
                    .font(.system(size: 17))
                    .foregroundColor(highlight ? .white.opacity(0.9) : AppTheme.textSecondary)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 24)
            .padding(.horizontal, 16)
            .background(highlight ? AppTheme.riskHigh : AppTheme.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: 18))
            .overlay(
                RoundedRectangle(cornerRadius: 18)
                    .stroke(primary && !highlight ? AppTheme.primary : Color.clear, lineWidth: 2.5)
            )
        }
        .disabled(isProcessing)
    }

    // MARK: - 处理中遮罩

    private var processingOverlay: some View {
        ZStack {
            Color.black.opacity(0.45).ignoresSafeArea()
            VStack(spacing: 18) {
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                    .scaleEffect(1.6)
                Text(processingMessage)
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundColor(.white)
                    .multilineTextAlignment(.center)
            }
            .padding(32)
            .background(Color.black.opacity(0.55))
            .clipShape(RoundedRectangle(cornerRadius: 18))
        }
    }

    // MARK: - 1. 拍照检测处理

    private func handleCapturedImage(_ image: UIImage) {
        isProcessing = true
        processingMessage = languageCode == "en"
            ? "Reading text from photo..."
            : "正在识别图片中的文字..."
        Task {
            let ocrText = await ImageOCR.recognize(from: image)
            print("[ElderDetection] OCR text length = \(ocrText.count): \(ocrText.prefix(80))")
            await MainActor.run {
                if ocrText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    isProcessing = false
                    resultText = languageCode == "en"
                        ? "No text detected in image"
                        : "图片里没有看到文字"
                    resultLabel = .medium
                    return
                }
                processingMessage = languageCode == "en"
                    ? "AI is checking..."
                    : "AI 正在帮您判断..."
                installWatchdog()
                vm.analyzeScreenshot(ocrText: ocrText)
            }
        }
    }

    /// 看门狗：45s 内 sink 没触发 applyAIResult 就强制结束
    private func installWatchdog() {
        watchdogTask?.cancel()
        watchdogTask = Task {
            try? await Task.sleep(nanoseconds: 45_000_000_000)
            if Task.isCancelled { return }
            await MainActor.run {
                if isProcessing {
                    print("[ElderDetection] watchdog: forced fail after 45s")
                    isProcessing = false
                    errorMessage = languageCode == "en"
                        ? "Network is slow. Please check your connection and try again."
                        : "网络不太好，请检查后再试一次"
                }
            }
        }
    }

    // MARK: - 2. 说一下：语音转文字 → AI

    private func startVoiceCapture() {
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
                    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
                    if trimmed.isEmpty {
                        errorMessage = languageCode == "en"
                            ? "Didn't catch what you said. Please try again."
                            : "没听清楚您说的话，再试一次吧"
                        return
                    }
                    isProcessing = true
                    processingMessage = languageCode == "en"
                        ? "AI is checking..."
                        : "AI 正在帮您判断..."
                    print("[ElderDetection] voice text: \(trimmed)")
                    installWatchdog()
                    vm.inputText = trimmed
                    vm.analyze()
                }
            } catch {
                await MainActor.run {
                    isRecordingVoice = false
                    errorMessage = error.localizedDescription
                }
            }
        }
    }

    private func stopVoiceCapture() {
        SpeechRecognitionService.shared.stopRecording()
        isRecordingVoice = false
    }

    // MARK: - 监听 AI 分析结果（用 vm.$turns 比 vm.$lastResult 更可靠：
    // 包含 .failure 错误也能展示，且每次 analyze 一定会触发新 turn）

    private func observeAIResult() {
        guard cancellables.isEmpty else { return }
        vm.$turns
            .receive(on: DispatchQueue.main)
            .sink { turns in
                guard let last = turns.last else { return }
                if case .done(let result) = last.status {
                    applyAIResult(result)
                }
            }
            .store(in: &cancellables)
    }

    private func applyAIResult(_ result: ChatTurnResult) {
        watchdogTask?.cancel()
        watchdogTask = nil
        isProcessing = false
        print("[ElderDetection] AI result received")
        switch result {
        case .analysis(let data):
            let label: ResultLabel = {
                switch data.riskLevel.lowercased() {
                case "high": return .high
                case "medium": return .medium
                case "low": return .low
                default: return .medium
                }
            }()
            resultText = data.summary.isEmpty
                ? (languageCode == "en" ? "Check completed" : "已完成检测")
                : data.summary
            resultLabel = label
        case .query:
            // 数字 query 等少见路径，按 medium 兜底
            resultText = languageCode == "en" ? "Check completed" : "已完成检测"
            resultLabel = .medium
        case .failure(let msg):
            // 给长辈看的失败原因要友好
            errorMessage = msg.isEmpty
                ? (languageCode == "en" ? "Sorry, we couldn't check it. Please try again." : "暂时没法判断，请稍后再试")
                : msg
        }
    }

    // MARK: - 取消所有进行中的操作

    private func cancelAnything() {
        tts.stop()
        voiceTask?.cancel()
        SpeechRecognitionService.shared.stopRecording()
        isProcessing = false
        isRecordingVoice = false
    }

    // MARK: - 结果页（J-P3）

    private var resultView: some View {
        ScrollView {
            VStack(spacing: 22) {
                ttsStatusBar
                    .padding(.horizontal, 18)
                    .padding(.top, 12)

                bigGauge

                if let txt = resultText {
                    contentRecallCard(text: txt)
                }

                warningCard

                actionButtons
            }
            .padding(.bottom, 32)
        }
        .onAppear {
            if let label = resultLabel {
                let spoken = ttsScript(for: label)
                Task { @MainActor in
                    try? await Task.sleep(nanoseconds: 300_000_000)
                    tts.speak(spoken, language: languageCode)
                }
            }
        }
        .onDisappear { tts.stop() }
    }

    private var ttsStatusBar: some View {
        HStack(spacing: 14) {
            Text(tts.isSpeaking && !tts.isPaused ? "🔊" : "🔈")
                .font(.system(size: 32))
            VStack(alignment: .leading, spacing: 6) {
                Text(tts.isSpeaking
                     ? (languageCode == "en" ? "Speaking..." : "正在为您朗读")
                     : (languageCode == "en" ? "Press to listen" : "点这里听一遍"))
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundColor(AppTheme.primary)
                ProgressView(value: tts.progress)
                    .progressViewStyle(.linear)
                    .tint(AppTheme.primary)
            }
            Button {
                if tts.isSpeaking {
                    tts.togglePause()
                } else if let label = resultLabel {
                    tts.speak(ttsScript(for: label), language: languageCode)
                }
            } label: {
                Text(tts.isPaused
                     ? (languageCode == "en" ? "▶ Resume" : "▶ 继续")
                     : (tts.isSpeaking
                        ? (languageCode == "en" ? "⏸ Pause" : "⏸ 暂停")
                        : (languageCode == "en" ? "▶ Play" : "▶ 播放")))
                    .font(.system(size: 16, weight: .semibold))
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(Color.white)
                    .foregroundColor(AppTheme.primary)
                    .clipShape(Capsule())
            }
        }
        .padding(16)
        .background(AppTheme.premiumWhyCard.opacity(0.5))
        .clipShape(RoundedRectangle(cornerRadius: 18))
    }

    private var bigGauge: some View {
        let label = resultLabel ?? .medium
        let color = label.color
        return ZStack {
            Circle()
                .stroke(Color.gray.opacity(0.15), lineWidth: 18)
                .frame(width: 240, height: 240)
            Circle()
                .trim(from: 0, to: label == .high ? 0.9 : label == .medium ? 0.5 : 0.1)
                .stroke(color, style: StrokeStyle(lineWidth: 18, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .frame(width: 240, height: 240)
            VStack(spacing: 8) {
                Text(label.displayName)
                    .font(.system(size: 56, weight: .heavy))
                    .foregroundColor(color)
                Text(label == .high
                     ? (languageCode == "en" ? "Likely a scam" : "非常可能是骗子")
                     : label == .medium
                     ? (languageCode == "en" ? "Be careful" : "请保持警惕")
                     : (languageCode == "en" ? "Looks safe" : "看起来安全"))
                    .font(.system(size: 18))
                    .foregroundColor(AppTheme.textSecondary)
            }
        }
        .padding(.vertical, 10)
    }

    private func contentRecallCard(text: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(languageCode == "en" ? "📞 What we checked" : "📞 检测到的内容")
                .font(.system(size: 17))
                .foregroundColor(AppTheme.textSecondary)
            Text(text)
                .font(.system(size: 22, weight: .semibold))
                .foregroundColor(AppTheme.textPrimary)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppTheme.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .padding(.horizontal, 18)
    }

    private var warningCard: some View {
        let label = resultLabel ?? .medium
        return VStack(alignment: .leading, spacing: 12) {
            Text(label == .high
                 ? (languageCode == "en" ? "⚠️ Do NOT do what they say" : "⚠️ 千万不要按对方说的做")
                 : label == .medium
                 ? (languageCode == "en" ? "❓ Not sure? Ask your child." : "❓ 拿不准的话，可以问问孩子")
                 : (languageCode == "en" ? "✅ No risk found" : "✅ 暂未发现风险"))
                .font(.system(size: 21, weight: .bold))
                .foregroundColor(label.color)
            Text(label == .high
                 ? (languageCode == "en"
                    ? "Real police or banks never ask you to transfer money to a 'safe account'."
                    : "这是常见的诈骗手段。真的警察、官方机构不会让您转钱到\"安全账户\"。")
                 : label == .medium
                 ? (languageCode == "en"
                    ? "When in doubt, ask family — especially your child."
                    : "不确定的事情多问几个人，特别是孩子。")
                 : (languageCode == "en"
                    ? "Still, take a breath whenever money is involved."
                    : "但还是要小心，遇到要钱的事都先停一停。"))
                .font(.system(size: 19))
                .foregroundColor(AppTheme.textPrimary)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(label.color.opacity(0.08))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(label.color.opacity(0.3), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .padding(.horizontal, 18)
    }

    private var actionButtons: some View {
        VStack(spacing: 16) {
            Button {
                tts.stop()
                dismiss()
                NotificationCenter.default.post(name: .elderRequestCallGuardian, object: nil)
            } label: {
                Text(languageCode == "en" ? "📞 Call my child" : "📞 立刻给孩子打电话")
                    .font(.system(size: 24, weight: .bold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 22)
                    .background(AppTheme.riskLow)
                    .clipShape(RoundedRectangle(cornerRadius: 18))
            }
            Button {
                tts.stop()
                resultText = nil
                resultLabel = nil
            } label: {
                Text(languageCode == "en" ? "🔍 Check another" : "🔍 再检测一个")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundColor(AppTheme.primary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 20)
                    .background(AppTheme.primary.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 18))
            }
        }
        .padding(.horizontal, 18)
        .padding(.top, 8)
    }

    private func ttsScript(for label: ResultLabel) -> String {
        if languageCode == "en" {
            switch label {
            case .high: return "Warning! This is very likely a scam. Do not do what they tell you. Please call your child to confirm."
            case .medium: return "We're not sure. Better ask your child before taking any action."
            case .low: return "No obvious risk found, but stay alert if money is involved."
            }
        }
        switch label {
        case .high: return "您要小心了，这个号码非常可能是骗子。千万不要按对方说的做，可以给孩子打电话问一下。"
        case .medium: return "我们不能完全确定。拿不准的话，建议给孩子打电话问一下。"
        case .low: return "暂时没有发现风险。但是遇到要钱的事情，还是要小心一点。"
        }
    }
}

public extension Notification.Name {
    static let elderRequestCallGuardian = Notification.Name("elder.requestCallGuardian")
    /// V3 #5：聊天里点"查个号码"等触发 → 主页输入框获取焦点
    static let focusHomeInput = Notification.Name("home.focusInput")
}
