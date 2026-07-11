//
//  FamilyChatView.swift
//  IsItSafe
//
//  V5.1 自建 IM 家庭群聊主界面（T1-2 微信级消息列表）。
//  绑定 FamilyChatCoordinator 的 published 状态；普通/长辈两套尺寸参数，同一套代码。
//
//  本文件覆盖 §7 对齐清单 1-6、13-15：时间胶囊 / 绿白气泡 / 发送态 / 撤回墓碑 / 系统消息 / 未读定位。
//  语音气泡(§7-7~9)在 T1-3、图片&大表情&+面板(§7-10~12)在 T1-4 接入（此处留渲染位）。
//

import SwiftUI
import PhotosUI
import UIKit

public struct FamilyChatView: View {
    let groupId: String
    let groupTitle: String
    /// userId → 成员（解析昵称/头像）；owner 用于"我"判断由 coordinator 提供
    let membersById: [String: FamilyMember]

    @ObservedObject private var chat = FamilyChatCoordinator.shared
    @ObservedObject private var elder = ElderModeService.shared
    @ObservedObject private var voicePlayer = ChatVoicePlayer.shared
    @ObservedObject private var router = AppRouter.shared
    @Environment(\.dismiss) private var dismiss
    @State private var draft: String = ""
    @State private var didInitialScroll = false

    // T1-4 面板
    @State private var showEmojiPanel = false
    @State private var showPlusPanel = false
    @State private var photoItem: PhotosPickerItem?
    // T1-6 举报确认
    @State private var reportTarget: ChatMessage?

    // 语音输入态
    @State private var voiceInputMode = false      // true=按住说话，false=文字
    @State private var isRecording = false
    @State private var recordCancelling = false     // 上滑到取消区
    @State private var recordSeconds = 0
    @State private var recordTimer: Timer?
    @State private var gestureActive = false        // 手势是否仍按住（同步，用于消解异步录音竞态）

    private var isElder: Bool { elder.isEnabled }
    private var myUserId: String? { TokenStore.shared.userId }

    private var messages: [ChatMessage] {
        let all = chat.messagesByGroup[groupId] ?? []
        guard !chat.blockedUserIds.isEmpty else { return all }
        // 屏蔽此人消息：隐藏被拉黑用户的普通消息（系统卡片不受影响）
        return all.filter { msg in
            guard let sid = msg.senderId else { return true }
            return !chat.blockedUserIds.contains(sid)
        }
    }

    public init(groupId: String, groupTitle: String, members: [FamilyMember]) {
        self.groupId = groupId
        self.groupTitle = groupTitle
        self.membersById = Dictionary(uniqueKeysWithValues: members.map { ($0.userId, $0) })
    }

    public var body: some View {
        VStack(spacing: 0) {
            messageList
            Divider()
            inputBar
            if showEmojiPanel { emojiPanel }
            if showPlusPanel { plusPanel }
        }
        .background(AppTheme.background)
        .navigationTitle(groupTitle)
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            chat.enterGroup(groupId)
            Task { await chat.refreshBlocked() }
        }
        .overlay { if isRecording { recordingOverlay } }
        .photosPicker(isPresented: $showPhotoPicker, selection: $photoItem, matching: .images)
        .onChange(of: photoItem) { _, newItem in
            guard let newItem else { return }
            Task { await handlePickedPhoto(newItem); photoItem = nil }
        }
        .confirmationDialog(
            localized(zh: "举报这条消息？", en: "Report this message?"),
            isPresented: Binding(get: { reportTarget != nil }, set: { if !$0 { reportTarget = nil } }),
            titleVisibility: .visible
        ) {
            Button(localized(zh: "举报（含诈骗/骚扰内容）", en: "Report"), role: .destructive) {
                if let t = reportTarget {
                    Task { await chat.report(groupId: groupId, messageId: t.id, reason: nil) }
                }
                reportTarget = nil
            }
            Button(localized(zh: "取消", en: "Cancel"), role: .cancel) { reportTarget = nil }
        }
    }

    @State private var showPhotoPicker = false

    // MARK: - 😊 表情面板

    private var emojiPanel: some View {
        let emojis = ["😀","😂","🥰","😍","👍","🙏","❤️","🎉","😭","😅","🤔","👌","💪","🌹","☀️","🍚","😴","🤣","😊","👏","🙌","💰","📞","⚠️"]
        return ScrollView {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 8), spacing: 12) {
                ForEach(emojis, id: \.self) { e in
                    Button { draft += e } label: {
                        Text(e).font(.system(size: 28))
                    }
                }
            }
            .padding(12)
        }
        .frame(height: 200)
        .background(AppTheme.tabBarBackground)
    }

    // MARK: - + 面板（相册 / 拍照）

    private var plusPanel: some View {
        HStack(spacing: 28) {
            plusItem(icon: "photo.on.rectangle", label: localized(zh: "相册", en: "Album")) {
                showPlusPanel = false; showPhotoPicker = true
            }
            plusItem(icon: "camera", label: localized(zh: "拍照", en: "Camera")) {
                showPlusPanel = false; showPhotoPicker = true // 简化：统一走图库选择器
            }
            Spacer()
        }
        .padding(20)
        .frame(height: 140, alignment: .top)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppTheme.tabBarBackground)
    }

    private func plusItem(icon: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 26))
                    .foregroundColor(AppTheme.textPrimary)
                    .frame(width: 60, height: 60)
                    .background(RoundedRectangle(cornerRadius: 14).fill(AppTheme.cardBackground))
                Text(label).font(.system(size: 12)).foregroundColor(AppTheme.textSecondary)
            }
        }
    }

    private func handlePickedPhoto(_ item: PhotosPickerItem) async {
        guard let data = try? await item.loadTransferable(type: Data.self),
              let image = UIImage(data: data) else { return }
        // 压缩到长边 1920
        let resized = Self.resize(image, maxSide: 1920)
        guard let jpeg = resized.jpegData(compressionQuality: 0.8) else { return }
        await chat.sendImage(groupId: groupId, imageData: jpeg,
                             width: Int(resized.size.width), height: Int(resized.size.height))
    }

    static func resize(_ image: UIImage, maxSide: CGFloat) -> UIImage {
        let w = image.size.width, h = image.size.height
        let longest = max(w, h)
        guard longest > maxSide else { return image }
        let scale = maxSide / longest
        let newSize = CGSize(width: w * scale, height: h * scale)
        let renderer = UIGraphicsImageRenderer(size: newSize)
        return renderer.image { _ in image.draw(in: CGRect(origin: .zero, size: newSize)) }
    }

    // MARK: - 录音浮层（按住说话时全屏提示）

    private var recordingOverlay: some View {
        ZStack {
            Color.black.opacity(0.55).ignoresSafeArea()
            VStack(spacing: 18) {
                Image(systemName: recordCancelling ? "xmark.circle.fill" : "mic.fill")
                    .font(.system(size: 54))
                    .foregroundColor(recordCancelling ? AppTheme.riskHigh : .white)
                    .frame(width: 120, height: 120)
                    .background(Circle().fill(recordCancelling ? Color.white.opacity(0.15) : AppTheme.primary))
                Text("\(recordSeconds)s")
                    .font(.system(size: 20, weight: .semibold)).foregroundColor(.white)
                Text(recordCancelling
                     ? localized(zh: "松开 取消", en: "Release to cancel")
                     : localized(zh: "上滑取消 · 松开发送", en: "Slide up to cancel · Release to send"))
                    .font(.system(size: 15)).foregroundColor(.white.opacity(0.9))
            }
        }
    }

    // MARK: - 消息列表

    private var messageList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 0) {
                    ForEach(Array(messages.enumerated()), id: \.element.id) { idx, msg in
                        let prev = idx > 0 ? messages[idx - 1] : nil
                        if shouldShowTime(msg, prev: prev) {
                            timePill(msg.createdAt)
                        }
                        row(for: msg)
                            .id(msg.id)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 3)
                    }
                    Color.clear.frame(height: 8).id(bottomAnchor)
                }
                .padding(.top, 8)
            }
            // 同时观察条数与末条 id：新消息 + 乐观→确认(id 变化)都触发滚动到底
            .onChange(of: messages.count) { _, _ in scrollToBottom(proxy) }
            .onChange(of: messages.last?.id) { _, _ in scrollToBottom(proxy) }
            .onAppear {
                DispatchQueue.main.async { scrollToBottom(proxy, animated: false) }
            }
        }
    }

    private let bottomAnchor = "chat.bottom"

    private func scrollToBottom(_ proxy: ScrollViewProxy, animated: Bool = true) {
        guard let last = messages.last else { return }
        if animated {
            withAnimation(.easeOut(duration: 0.2)) { proxy.scrollTo(last.id, anchor: .bottom) }
        } else {
            proxy.scrollTo(last.id, anchor: .bottom)
        }
    }

    // MARK: - 行渲染分派

    @ViewBuilder
    private func row(for msg: ChatMessage) -> some View {
        if msg.type == .system {
            systemRow(msg)
        } else if msg.isRecalled {
            recalledRow(msg)
        } else if isMine(msg) {
            selfRow(msg).contextMenu { menuItems(for: msg) }
        } else {
            otherRow(msg).contextMenu { menuItems(for: msg) }
        }
    }

    // MARK: - 长按菜单（§7-16 合规最小集 + 查一查）

    @ViewBuilder
    private func menuItems(for msg: ChatMessage) -> some View {
        // 复制（文本）
        if msg.type == .text || msg.type == .bigEmoji, let text = msg.content, !text.isEmpty {
            Button {
                UIPasteboard.general.string = text
            } label: { Label(localized(zh: "复制", en: "Copy"), systemImage: "doc.on.doc") }

            // 查一查是不是骗局：转问助手分析（决策 #6）
            Button {
                router.analyzeInAssistant(text)
            } label: { Label(localized(zh: "查一查是不是骗局", en: "Check for scam"), systemImage: "magnifyingglass") }
        }

        // 撤回（本人 2 分钟内）
        if isMine(msg), msg.isConfirmed,
           Date().timeIntervalSince(msg.createdAt) < 120 {
            Button(role: .destructive) {
                Task { await chat.recall(groupId: groupId, messageId: msg.id) }
            } label: { Label(localized(zh: "撤回", en: "Recall"), systemImage: "arrow.uturn.backward") }
        }

        // 举报（他人消息）
        if !isMine(msg) {
            Button(role: .destructive) {
                reportTarget = msg
            } label: { Label(localized(zh: "举报", en: "Report"), systemImage: "exclamationmark.bubble") }
        }
    }

    // MARK: - 系统消息（居中灰字）

    private func systemRow(_ msg: ChatMessage) -> some View {
        HStack {
            Spacer()
            Text(msg.content ?? "")
                .font(.system(size: elderScaled(12)))
                .foregroundColor(AppTheme.textSecondary)
                .padding(.horizontal, 10).padding(.vertical, 4)
                .background(Capsule().fill(AppTheme.textSecondary.opacity(0.12)))
            Spacer()
        }
        .padding(.vertical, 4)
    }

    private func recalledRow(_ msg: ChatMessage) -> some View {
        let who = isMine(msg) ? (localized(zh: "你", en: "You")) : senderName(msg)
        return HStack {
            Spacer()
            Text("\(who) \(localized(zh: "撤回了一条消息", en: "recalled a message"))")
                .font(.system(size: elderScaled(12)))
                .foregroundColor(AppTheme.textSecondary)
            Spacer()
        }
        .padding(.vertical, 2)
    }

    // MARK: - 自己发的（右侧绿泡）

    private func selfRow(_ msg: ChatMessage) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Spacer(minLength: 40)
            VStack(alignment: .trailing, spacing: 3) {
                bubble(for: msg, mine: true)
                statusLine(msg)
            }
            avatar(for: msg)
        }
    }

    // MARK: - 别人发的（左侧白泡 + 昵称）

    private func otherRow(_ msg: ChatMessage) -> some View {
        HStack(alignment: .top, spacing: 8) {
            avatar(for: msg)
            VStack(alignment: .leading, spacing: 3) {
                Text(senderName(msg))
                    .font(.system(size: elderScaled(11)))
                    .foregroundColor(AppTheme.textSecondary)
                bubble(for: msg, mine: false)
            }
            Spacer(minLength: 40)
        }
    }

    // MARK: - 气泡内容（按 type 分派）

    @ViewBuilder
    private func bubble(for msg: ChatMessage, mine: Bool) -> some View {
        switch msg.type {
        case .text, .bigEmoji, .unknown:
            textBubble(msg, mine: mine)
        case .voice:
            voiceBubble(msg, mine: mine)
        case .image:
            imageBubble(msg)
        case .card:
            CardMessageView(message: msg, groupId: groupId, membersById: membersById,
                            isElder: isElder, scale: { elderScaled($0) })
                .frame(maxWidth: .infinity, alignment: .leading)
        case .system:
            EmptyView()
        }
    }

    private func textBubble(_ msg: ChatMessage, mine: Bool) -> some View {
        let isBig = msg.type == .bigEmoji
        return Text(msg.content ?? "")
            .font(.system(size: isBig ? elderScaled(40) : elderScaled(16)))
            .foregroundColor(mine ? Color(hex: "1A1F2E") : AppTheme.textPrimary)
            .padding(.horizontal, isBig ? 4 : 13)
            .padding(.vertical, isBig ? 2 : 9)
            .background(
                isBig ? nil :
                RoundedRectangle(cornerRadius: 14)
                    .fill(mine ? Color(hex: "95EC69") : AppTheme.cardBackground)
            )
            .textSelection(.enabled)
    }

    /// 语音气泡：宽度随时长变化（1~60s → 80~220pt），点击播放，下方展示本地转文字
    @ViewBuilder
    private func voiceBubble(_ msg: ChatMessage, mine: Bool) -> some View {
        let duration = msg.payload?.int("duration") ?? 1
        let url = msg.payload?.string("url") ?? ""
        let isPlaying = voicePlayer.playingURL == url && !url.isEmpty
        let width = min(220, 80 + CGFloat(min(duration, 60)) * 2.4)
        VStack(alignment: mine ? .trailing : .leading, spacing: 4) {
            Button {
                if !url.isEmpty { voicePlayer.toggle(urlString: url) }
            } label: {
                HStack(spacing: 8) {
                    if !mine { voiceIcon(isPlaying) }
                    Text("\(duration)\"")
                        .font(.system(size: elderScaled(14)))
                        .foregroundColor(mine ? Color(hex: "1A1F2E") : AppTheme.textPrimary)
                    if mine { voiceIcon(isPlaying) }
                }
                .frame(width: width, alignment: mine ? .trailing : .leading)
                .padding(.horizontal, 13).padding(.vertical, 10)
                .background(RoundedRectangle(cornerRadius: 14)
                    .fill(mine ? Color(hex: "95EC69") : AppTheme.cardBackground))
            }
            .buttonStyle(.plain)
            // 本地转文字直接展示（比微信多一步，长辈不用长按转）
            if let t = msg.content, !t.isEmpty {
                Text(t)
                    .font(.system(size: elderScaled(13)))
                    .foregroundColor(AppTheme.textSecondary)
                    .padding(.horizontal, 10).padding(.vertical, 6)
                    .background(RoundedRectangle(cornerRadius: 8).fill(AppTheme.textSecondary.opacity(0.08)))
            }
        }
    }

    private func voiceIcon(_ playing: Bool) -> some View {
        Image(systemName: playing ? "speaker.wave.2.fill" : "waveform")
            .font(.system(size: elderScaled(16)))
            .foregroundColor(AppTheme.primary)
    }

    /// 图片气泡：按 payload 宽高比占位（加载时不跳动），最大边 200pt
    @ViewBuilder
    private func imageBubble(_ msg: ChatMessage) -> some View {
        let w = CGFloat(msg.payload?.int("w") ?? 1)
        let h = CGFloat(msg.payload?.int("h") ?? 1)
        let maxSide: CGFloat = 200
        let ratio = w > 0 && h > 0 ? w / h : 1
        let (bw, bh): (CGFloat, CGFloat) = ratio >= 1 ? (maxSide, maxSide / ratio) : (maxSide * ratio, maxSide)
        let urlStr = msg.payload?.string("url") ?? ""
        AsyncImage(url: URL(string: urlStr)) { phase in
            switch phase {
            case .success(let img): img.resizable().scaledToFill()
            case .failure: Image(systemName: "photo").foregroundColor(AppTheme.textSecondary)
            default: ProgressView()
            }
        }
        .frame(width: bw, height: bh)
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private func placeholderBubble(icon: String, label: String, mine: Bool) -> some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
            Text(label).font(.system(size: elderScaled(15)))
        }
        .foregroundColor(mine ? Color(hex: "1A1F2E") : AppTheme.textPrimary)
        .padding(.horizontal, 13).padding(.vertical, 9)
        .background(RoundedRectangle(cornerRadius: 14).fill(mine ? Color(hex: "95EC69") : AppTheme.cardBackground))
    }

    private func cardPlaceholder(_ msg: ChatMessage) -> some View {
        // 卡片完整渲染在 Sprint 2 T2-2；此处占位保证消息流不断档
        VStack(alignment: .leading, spacing: 4) {
            Text(msg.payload?.string("title") ?? localized(zh: "官方卡片", en: "Card"))
                .font(.system(size: elderScaled(15), weight: .semibold))
                .foregroundColor(AppTheme.textPrimary)
            if let sum = msg.payload?.string("summary") {
                Text(sum).font(.system(size: elderScaled(13))).foregroundColor(AppTheme.textSecondary)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 14).fill(AppTheme.cardBackground))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(AppTheme.primary.opacity(0.25), lineWidth: 1))
    }

    // MARK: - 发送状态 / 已读

    @ViewBuilder
    private func statusLine(_ msg: ChatMessage) -> some View {
        switch msg.sendState {
        case .sending:
            ProgressView().scaleEffect(0.6).frame(height: 14)
        case .failed:
            Button {
                Task { await chat.resend(msg) }
            } label: {
                Image(systemName: "exclamationmark.circle.fill")
                    .foregroundColor(AppTheme.riskHigh)
                    .font(.system(size: elderScaled(15)))
            }
        default:
            // 已确认：读回执名单在 §7-4 完整版接入，先显示"已送达"
            if msg.isConfirmed {
                Text(localized(zh: "已送达", en: "Sent"))
                    .font(.system(size: elderScaled(10)))
                    .foregroundColor(AppTheme.textSecondary)
            }
        }
    }

    // MARK: - 头像

    private func avatar(for msg: ChatMessage) -> some View {
        let name = isMine(msg) ? (localized(zh: "我", en: "Me")) : senderName(msg)
        let initial = String(name.prefix(1))
        return Text(initial)
            .font(.system(size: elderScaled(16), weight: .semibold))
            .foregroundColor(.white)
            .frame(width: elderScaled(38), height: elderScaled(38))
            .background(RoundedRectangle(cornerRadius: 8).fill(avatarColor(for: msg.senderId ?? "sys")))
    }

    // MARK: - 输入栏（T1-2 仅文字；语音键 T1-3、+/😊面板 T1-4）

    private var inputBar: some View {
        HStack(spacing: 8) {
            // 语音/文字切换（长辈模式语音键更大，见 §6.2）
            Button {
                voiceInputMode.toggle()
            } label: {
                Image(systemName: voiceInputMode ? "keyboard" : "mic.circle")
                    .font(.system(size: elderScaled(voiceInputMode ? 24 : 26)))
                    .foregroundColor(AppTheme.textSecondary)
                    .frame(width: elderScaled(38), height: elderScaled(38))
            }

            if voiceInputMode {
                pressToTalkButton
            } else {
                TextField(localized(zh: "发消息…", en: "Message…"), text: $draft, axis: .vertical)
                    .font(.system(size: elderScaled(16)))
                    .lineLimit(1...4)
                    .padding(.horizontal, 12).padding(.vertical, elderScaled(8))
                    .background(RoundedRectangle(cornerRadius: 10).fill(AppTheme.cardBackground))
                    .onSubmit(sendDraft)
                Button {
                    showPlusPanel = false
                    showEmojiPanel.toggle()
                } label: {
                    Image(systemName: "face.smiling")
                        .font(.system(size: elderScaled(24)))
                        .foregroundColor(AppTheme.textSecondary)
                }
                if draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Button {
                        showEmojiPanel = false
                        showPlusPanel.toggle()
                    } label: {
                        Image(systemName: "plus.circle")
                            .font(.system(size: elderScaled(26)))
                            .foregroundColor(AppTheme.textSecondary)
                    }
                } else {
                    Button(action: sendDraft) {
                        Text(localized(zh: "发送", en: "Send"))
                            .font(.system(size: elderScaled(15), weight: .semibold))
                            .foregroundColor(.white)
                            .padding(.horizontal, 14).padding(.vertical, 8)
                            .background(RoundedRectangle(cornerRadius: 10).fill(AppTheme.primary))
                    }
                }
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(AppTheme.tabBarBackground)
    }

    /// 按住说话按钮：长辈模式占主位（更高），上滑取消
    private var pressToTalkButton: some View {
        Text(isRecording
             ? (recordCancelling ? localized(zh: "松开 取消", en: "Release to cancel") : localized(zh: "松开 发送", en: "Release to send"))
             : localized(zh: "按住 说话", en: "Hold to talk"))
            .font(.system(size: elderScaled(16), weight: .semibold))
            .foregroundColor(AppTheme.textPrimary)
            .frame(maxWidth: .infinity)
            .frame(height: elderScaled(isElder ? 52 : 40))
            .background(RoundedRectangle(cornerRadius: elderScaled(12))
                .fill(isRecording ? AppTheme.primary.opacity(0.18) : AppTheme.cardBackground))
            .overlay(RoundedRectangle(cornerRadius: elderScaled(12))
                .stroke(AppTheme.border, lineWidth: isElder ? 1.5 : 0.5))
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        if !isRecording { startRecording() }
                        // 上滑超过 60pt 视为进入取消区
                        recordCancelling = value.translation.height < -60
                    }
                    .onEnded { _ in endRecording(cancelled: recordCancelling) }
            )
    }

    private func sendDraft() {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        draft = ""
        let type: ChatMessageType = isPureEmoji(text) ? .bigEmoji : .text
        Task { await chat.send(groupId: groupId, type: type, content: text) }
    }

    // MARK: - 语音录制控制

    private func startRecording() {
        recordCancelling = false
        recordSeconds = 0
        gestureActive = true   // 同步置位：手势仍按住
        Task {
            let ok = await VoiceMessageComposer.shared.startRecording()
            guard ok else { await MainActor.run { isRecording = false }; return }
            await MainActor.run {
                // 关键：录音真正就绪时若手势已松开（快速点按），立即收尾，避免卡在录音浮层
                guard gestureActive else {
                    VoiceMessageComposer.shared.cancelRecording()
                    isRecording = false
                    return
                }
                isRecording = true
                recordTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
                    recordSeconds = VoiceMessageComposer.shared.elapsedSeconds
                }
            }
        }
    }

    private func endRecording(cancelled: Bool) {
        gestureActive = false
        recordTimer?.invalidate(); recordTimer = nil
        // 录音尚未就绪（异步 start 未回）：置位让 start 回调自行取消，这里直接返回
        guard isRecording else { return }
        isRecording = false
        recordCancelling = false
        if cancelled {
            VoiceMessageComposer.shared.cancelRecording()
            return
        }
        Task {
            guard let voice = await VoiceMessageComposer.shared.finishAndCompose() else { return }
            await chat.send(groupId: groupId, type: .voice,
                            content: voice.transcript.isEmpty ? nil : voice.transcript,
                            payload: ChatVoicePayload.make(voice))
        }
    }

    // MARK: - 辅助

    private func isMine(_ msg: ChatMessage) -> Bool {
        guard let mine = myUserId else { return false }
        return msg.senderId == mine
    }

    private func senderName(_ msg: ChatMessage) -> String {
        guard let sid = msg.senderId else { return localized(zh: "官方", en: "Official") }
        if let m = membersById[sid] { return m.effectiveName }
        return localized(zh: "家人", en: "Family")
    }

    /// 时间胶囊：首条或与上一条间隔 > 5 分钟才显示（微信同款）
    private func shouldShowTime(_ msg: ChatMessage, prev: ChatMessage?) -> Bool {
        guard let prev else { return true }
        return msg.createdAt.timeIntervalSince(prev.createdAt) > 5 * 60
    }

    private func timePill(_ date: Date) -> some View {
        Text(Self.formatTime(date))
            .font(.system(size: elderScaled(11)))
            .foregroundColor(AppTheme.textSecondary)
            .padding(.horizontal, 10).padding(.vertical, 2)
            .background(Capsule().fill(AppTheme.textSecondary.opacity(0.12)))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
    }

    private func avatarColor(for seed: String) -> Color {
        let palette = ["8B9DC3", "E8A2B8", "B8A2E8", "7FBF9E", "E8C07F", "7FA8E8"]
        let idx = abs(seed.hashValue) % palette.count
        return Color(hex: palette[idx])
    }

    private func isPureEmoji(_ s: String) -> Bool {
        let scalars = s.unicodeScalars.filter { !$0.properties.isEmojiPresentation && !($0.properties.isEmoji && $0.value > 0x238C) }
        // 简化：无普通字符且长度 ≤ 3 视为大表情
        let hasEmoji = s.unicodeScalars.contains { $0.properties.isEmoji && $0.value > 0x238C }
        return hasEmoji && scalars.isEmpty && s.count <= 3
    }

    private func elderScaled(_ base: CGFloat) -> CGFloat {
        isElder ? base * 1.2 : base
    }

    private func localized(zh: String, en: String) -> String {
        (UserDefaults.standard.string(forKey: "isitsafe.language") == "en") ? en : zh
    }

    static func formatTime(_ date: Date) -> String {
        let cal = Calendar.current
        let f = DateFormatter()
        if cal.isDateInToday(date) { f.dateFormat = "HH:mm" }
        else if cal.isDateInYesterday(date) { f.dateFormat = "'昨天' HH:mm" }
        else if let days = cal.dateComponents([.day], from: date, to: Date()).day, days < 7 {
            f.dateFormat = "EEEE HH:mm"; f.locale = Locale(identifier: "zh_CN")
        } else { f.dateFormat = "yyyy/M/d HH:mm" }
        return f.string(from: date)
    }
}
