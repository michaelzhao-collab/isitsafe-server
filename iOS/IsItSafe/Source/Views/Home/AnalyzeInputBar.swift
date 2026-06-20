//
//  AnalyzeInputBar.swift
//  IsItSafe
//
//  拍摄 | 文字输入框/按住说话 | 语音入口 | 加号 | 发送。支持待发图片缩略图。
//

import SwiftUI
import UIKit

public struct AnalyzeInputBar: View {
    @Binding public var text: String
    public var pendingImage: UIImage?
    public var onRemovePendingImage: () -> Void
    public var onSubmit: () -> Void
    public var onSendWithImage: (UIImage) -> Void
    public var onSendWithImageAndText: ((UIImage, String) -> Void)?
    public var onCamera: () -> Void
    public var onVoiceToggle: () -> Void
    public var onPlus: () -> Void
    public var onVoiceHoldStart: (() -> Void)?
    public var onVoiceHoldEnd: (() -> Void)?
    /// 上滑取消录音回调；为 nil 时退化为普通 hold-end
    public var onVoiceCancel: (() -> Void)?
    /// 语音状态文案：按住说话 / 请说话...... / 说话中......
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    public var voiceHintText: String = "按住说话"
    @FocusState.Binding public var isFocused: Bool
    /// 录音状态变化回调：HomeContainerView 用来弹/隐全屏录音浮层
    public var onRecordingStateChange: ((_ active: Bool, _ cancelMode: Bool) -> Void)?

    // 录音手势状态
    @State private var isRecording = false
    @State private var isCancellableMode = false
    /// 上滑超过此阈值进入取消态（点单位）
    private let cancelThreshold: CGFloat = 60

    private var localizedVoiceHintText: String {
        if languageCode == "en" {
            if voiceHintText == "按住说话" { return "Hold to speak" }
            return voiceHintText
        }
        return voiceHintText
    }

    public init(
        text: Binding<String>,
        pendingImage: UIImage?,
        onRemovePendingImage: @escaping () -> Void,
        onSubmit: @escaping () -> Void,
        onSendWithImage: @escaping (UIImage) -> Void,
        onSendWithImageAndText: ((UIImage, String) -> Void)? = nil,
        onCamera: @escaping () -> Void,
        onVoiceToggle: @escaping () -> Void,
        onPlus: @escaping () -> Void,
        onVoiceHoldStart: (() -> Void)? = nil,
        onVoiceHoldEnd: (() -> Void)? = nil,
        onVoiceCancel: (() -> Void)? = nil,
        voiceHintText: String = "按住说话",
        isFocused: FocusState<Bool>.Binding,
        onRecordingStateChange: ((Bool, Bool) -> Void)? = nil
    ) {
        self._text = text
        self.pendingImage = pendingImage
        self.onRemovePendingImage = onRemovePendingImage
        self.onSubmit = onSubmit
        self.onSendWithImage = onSendWithImage
        self.onSendWithImageAndText = onSendWithImageAndText
        self.onCamera = onCamera
        self.onVoiceToggle = onVoiceToggle
        self.onPlus = onPlus
        self.onVoiceHoldStart = onVoiceHoldStart
        self.onVoiceHoldEnd = onVoiceHoldEnd
        self.onVoiceCancel = onVoiceCancel
        self.voiceHintText = voiceHintText
        self._isFocused = isFocused
        self.onRecordingStateChange = onRecordingStateChange
    }

    /// 有输入内容（文字或待发图）时隐藏拍摄与语音入口
    private var hasInputContent: Bool { canSend }

    public var body: some View {
        HStack(alignment: .bottom, spacing: 10) {
            // 拍摄：无输入内容时显示
            if !hasInputContent {
                Button(action: onCamera) {
                    Image(systemName: "camera.circle")
                        .font(.system(size: 32))
                        .foregroundColor(AppTheme.primary)
                }
                .buttonStyle(.plain)
            }

            if isVoiceMode {
                voiceModeContent
            } else {
                textModeContent
            }

            // 加号：打开拍照和相册
            Button(action: onPlus) {
                Image(systemName: "plus.circle.fill")
                    .font(.system(size: 32))
                    .foregroundColor(AppTheme.primary)
            }
            .buttonStyle(.plain)

            // 发送按钮：仅当输入框已聚焦（键盘弹出）且有待发内容时显示
            if isFocused, canSend {
                sendButton
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 12)
        .background(AppTheme.tabBarBackground)
    }

    @State private var isVoiceMode = false

    private var textModeContent: some View {
        HStack(alignment: .bottom, spacing: 10) {
            if let img = pendingImage {
                ZStack(alignment: .topTrailing) {
                    Image(uiImage: img)
                        .resizable()
                        .scaledToFill()
                        .frame(width: 44, height: 44)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    Button(action: onRemovePendingImage) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 18))
                            .foregroundStyle(.white)
                            .shadow(radius: 1)
                    }
                    .offset(x: 6, y: -6)
                }
            }
            TextField(languageCode == "en" ? "Ask about anything suspicious…" : "输入可疑信息进行检测", text: $text, axis: .vertical)
                .textFieldStyle(.plain)
                .foregroundColor(AppTheme.textPrimary)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Color(UIColor.tertiarySystemFill))
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                .lineLimit(1...4)
                .focused($isFocused)
                .onSubmit(onSubmit)
            // 语音入口：无输入内容时显示
            if !hasInputContent {
                Button(action: {
                    isVoiceMode = true
                    onVoiceToggle()
                }) {
                    Image(systemName: "mic.fill")
                        .font(.system(size: 32))
                        .foregroundColor(AppTheme.primary)
                }
                .buttonStyle(.plain)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
        .onTapGesture { isFocused = true }
    }

    private var voiceModeContent: some View {
        VStack(spacing: 6) {
            // 录音激活时上方显示"上滑取消"hint；进入取消态后变红强提示
            if isRecording {
                HStack(spacing: 4) {
                    Image(systemName: isCancellableMode ? "xmark.circle.fill" : "chevron.up")
                        .font(.system(size: 12, weight: .semibold))
                    Text(cancelHintText)
                        .font(.caption)
                }
                .foregroundColor(isCancellableMode ? .red : AppTheme.secondaryText)
                .transition(.opacity)
            }
            HStack(alignment: .center, spacing: 10) {
                if let img = pendingImage {
                    ZStack(alignment: .topTrailing) {
                        Image(uiImage: img)
                            .resizable()
                            .scaledToFill()
                            .frame(width: 44, height: 44)
                            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                        Button(action: onRemovePendingImage) {
                            Image(systemName: "xmark.circle.fill")
                                .font(.system(size: 18))
                                .foregroundStyle(.white)
                                .shadow(radius: 1)
                        }
                        .offset(x: 6, y: -6)
                    }
                }
                Text(voiceButtonText)
                    .font(.subheadline)
                    .foregroundColor(isCancellableMode ? .white : AppTheme.secondaryText)
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
                    .background(voiceButtonBackground)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .contentShape(Rectangle())
                    .gesture(voiceGesture)
                    .accessibilityLabel(isRecording
                        ? (isCancellableMode
                            ? (languageCode == "en" ? "Release to cancel" : "松手取消")
                            : (languageCode == "en" ? "Recording, slide up to cancel" : "录音中，上滑取消"))
                        : (languageCode == "en" ? "Hold to speak" : "按住说话"))
                Button(action: {
                    // V4 业主反馈"语音点按一下卡死"：极短点按时 SwiftUI sequenced gesture
                    // 的 onEnded 偶发不触发 → onVoiceHoldEnd 没调用 → SpeechRecognition 永远卡录音中。
                    // 这里把键盘图标改成"录音中点击=取消逃生"，无论 gesture 状态如何都能恢复。
                    if isRecording {
                        isRecording = false
                        isCancellableMode = false
                        if let onCancel = onVoiceCancel {
                            onCancel()
                        } else {
                            onVoiceHoldEnd?()
                        }
                        onRecordingStateChange?(false, false)
                    } else {
                        isVoiceMode = false
                        onVoiceToggle()
                    }
                }) {
                    Image(systemName: isRecording ? "xmark.circle.fill" : "keyboard")
                        .font(.system(size: 32))
                        .foregroundColor(isRecording ? .red : AppTheme.primary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(isRecording
                    ? (languageCode == "en" ? "Cancel recording" : "取消录音")
                    : (languageCode == "en" ? "Switch to keyboard" : "切回键盘"))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .animation(.easeInOut(duration: 0.15), value: isCancellableMode)
        .animation(.easeInOut(duration: 0.15), value: isRecording)
    }

    private var voiceButtonText: String {
        if isCancellableMode {
            return languageCode == "en" ? "Release to cancel" : "松手取消"
        }
        if isRecording {
            return languageCode == "en" ? "Listening…" : "正在录音…"
        }
        return localizedVoiceHintText
    }

    private var cancelHintText: String {
        if isCancellableMode {
            return languageCode == "en" ? "Release to cancel" : "松手取消发送"
        }
        return languageCode == "en" ? "Slide up to cancel" : "上滑取消"
    }

    private var voiceButtonBackground: Color {
        if isCancellableMode { return .red.opacity(0.85) }
        if isRecording { return AppTheme.primary.opacity(0.18) }
        return Color(UIColor.tertiarySystemFill)
    }

    /// 长按 0.08s 进入录音 → DragGesture 跟踪上滑距离 → 释放时根据 isCancellableMode 决定 cancel 或 end
    /// V4 优化：minimumDuration 从 0.25 降到 0.08；case .first 也立刻启动录音
    /// （之前必须等 DragGesture 第一次 drag 事件才 fire，长按不滑时有 100-200ms hand-off 延迟）
    private var voiceGesture: some Gesture {
        LongPressGesture(minimumDuration: 0.08)
            .sequenced(before: DragGesture(minimumDistance: 0, coordinateSpace: .local))
            .onChanged { value in
                switch value {
                case .first:
                    // 长按达到 minimumDuration 即视为开始录音，不再等 drag
                    // 修掉"长按不动→不录音"的体感延迟
                    if !isRecording {
                        isRecording = true
                        onVoiceHoldStart?()
                        onRecordingStateChange?(true, false)
                    }
                case .second(true, let drag):
                    if !isRecording {
                        isRecording = true
                        onVoiceHoldStart?()
                        onRecordingStateChange?(true, false)
                    }
                    if let drag = drag {
                        let dy = -drag.translation.height  // 上滑为正
                        let shouldCancel = dy > cancelThreshold
                        if shouldCancel != isCancellableMode {
                            isCancellableMode = shouldCancel
                            onRecordingStateChange?(true, shouldCancel)
                        }
                    }
                default:
                    break
                }
            }
            .onEnded { _ in
                if isRecording {
                    if isCancellableMode {
                        // 优先调用 cancel，回调缺失则退化为 end
                        if let onCancel = onVoiceCancel {
                            onCancel()
                        } else {
                            onVoiceHoldEnd?()
                        }
                    } else {
                        onVoiceHoldEnd?()
                    }
                }
                isRecording = false
                isCancellableMode = false
                onRecordingStateChange?(false, false)
            }
    }

    private var sendButton: some View {
        Button(action: performSend) {
            Image(systemName: "arrow.up.circle.fill")
                .font(.system(size: 32))
                .foregroundColor(AppTheme.primary)
        }
        .buttonStyle(.plain)
        .a11y(
            label: languageCode == "en" ? "Send query" : "发送查询",
            hint: languageCode == "en" ? "Submit your question to AI" : "提交你的问题给 AI 分析"
        )
    }

    private var canSend: Bool {
        if pendingImage != nil { return true }
        return !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func performSend() {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if let img = pendingImage {
            if !trimmed.isEmpty, let sendBoth = onSendWithImageAndText {
                sendBoth(img, trimmed)
            } else {
                onSendWithImage(img)
            }
            // 发送后立刻清空输入栏的待发图片与文字（避免 UI 残留）
            onRemovePendingImage()
            text = ""
            return
        }
        onSubmit()
    }
}
