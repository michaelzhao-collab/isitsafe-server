//
//  AnalyzeInputBar.swift
//  IsItSafe
//
//  拍摄 | 文字输入框/按住说话 | 语音入口 | 加号 | 发送。支持待发图片缩略图。
//

import SwiftUI

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
    @FocusState.Binding public var isFocused: Bool

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
        isFocused: FocusState<Bool>.Binding
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
        self._isFocused = isFocused
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
            TextField("输入可疑信息进行检测", text: $text, axis: .vertical)
                .textFieldStyle(.plain)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Color(white: 0.96))
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
            Text("按住说话")
                .font(.subheadline)
                .foregroundColor(AppTheme.secondaryText)
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .contentShape(Rectangle())
                .onLongPressGesture(minimumDuration: 10, maximumDistance: .infinity, pressing: { pressing in
                    if pressing {
                        onVoiceHoldStart?()
                    } else {
                        onVoiceHoldEnd?()
                    }
                }, perform: {})
            Button(action: {
                isVoiceMode = false
                onVoiceToggle()
            }) {
                Image(systemName: "keyboard")
                    .font(.system(size: 32))
                    .foregroundColor(AppTheme.primary)
            }
            .buttonStyle(.plain)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var sendButton: some View {
        Button(action: performSend) {
            Image(systemName: "arrow.up.circle.fill")
                .font(.system(size: 32))
                .foregroundColor(AppTheme.primary)
        }
        .buttonStyle(.plain)
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
            return
        }
        onSubmit()
    }
}
