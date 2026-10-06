//
//  ChatSyncEngine.swift
//  IsItSafe
//
//  V5.1 自建 IM 增量同步引擎（Sprint 0 雏形）。
//
//  核心思路（与微信一致：拉为主、推为辅）：
//   - 一切围绕 seq。WebSocket 只送"有新消息"的轻信号，消息体永远走 pull(afterSeq)。
//   - 三条收敛：WS 信号 / APNs 点开 / 前台激活，全部触发同一个 syncGroup(afterSeq)。
//   - 发送乐观上屏 → 幂等 clientMsgId → 失败重试 → 仍失败标红点可重发。
//

import Foundation
import UIKit

/// 传输层抽象（便于把引擎与 NetworkManager 解耦、可单测）
public protocol ChatTransport: Sendable {
    func send(groupId: String, body: ChatSendRequest) async throws -> ChatMessage
    func pull(groupId: String, afterSeq: Int64?, beforeSeq: Int64?, limit: Int?) async throws -> ChatPullResponse
    func setReadCursor(groupId: String, seq: Int64) async throws -> ChatReadCursorResponse
    func recall(groupId: String, messageId: String) async throws -> ChatMessage
}

/// 用 NetworkManager 实现的传输层
nonisolated public struct NetworkChatTransport: ChatTransport {
    public init() {}

    public func send(groupId: String, body: ChatSendRequest) async throws -> ChatMessage {
        try await NetworkManager.shared.request(endpoint: .chatSendMessage(groupId: groupId), body: body)
    }
    public func pull(groupId: String, afterSeq: Int64?, beforeSeq: Int64?, limit: Int?) async throws -> ChatPullResponse {
        try await NetworkManager.shared.request(
            endpoint: .chatPullMessages(
                groupId: groupId,
                afterSeq: afterSeq.map { Int($0) },
                beforeSeq: beforeSeq.map { Int($0) },
                limit: limit
            )
        )
    }
    public func setReadCursor(groupId: String, seq: Int64) async throws -> ChatReadCursorResponse {
        try await NetworkManager.shared.request(endpoint: .chatReadCursor(groupId: groupId),
                                                 body: ChatReadCursorRequest(seq: seq))
    }
    public func recall(groupId: String, messageId: String) async throws -> ChatMessage {
        try await NetworkManager.shared.request(endpoint: .chatRecall(groupId: groupId),
                                                 body: ChatRecallRequest(messageId: messageId))
    }
}

/// 媒体上传抽象（语音失败重传需要在引擎内重新上传，故与 transport 一样做成可注入）
public protocol ChatMediaUploader: Sendable {
    func uploadVoice(data: Data, filename: String) async throws -> String
    func uploadImage(data: Data, filename: String) async throws -> String
}

/// 用 NetworkManager 实现的媒体上传
nonisolated public struct NetworkChatMediaUploader: ChatMediaUploader {
    public init() {}
    public func uploadVoice(data: Data, filename: String) async throws -> String {
        try await NetworkManager.shared.uploadAudio(
            type: "family_voice", audioData: data, mimeType: "audio/mp4", filename: filename
        )
    }
    public func uploadImage(data: Data, filename: String) async throws -> String {
        try await NetworkManager.shared.uploadFile(
            type: "family_image", imageData: data, mimeType: "image/jpeg", filename: filename
        )
    }
}

/// 增量同步引擎（actor 保证并发安全）
public actor ChatSyncEngine {
    private let store: ChatMessageStore
    private let transport: ChatTransport
    private let uploader: ChatMediaUploader
    private let currentUserId: () -> String?

    /// 首次进群拉取的最近消息条数（不再从 seq=0 逐页追平整个群历史）
    private static let firstSyncPageSize = 50
    /// 语音乐观消息在 payload 里暂存本地文件路径的 key（上传成功后被 url 取代）
    static let localPathKey = "localPath"

    /// 每群一把"同步中"标志，避免同一群并发拉取造成乱序
    private var syncing: Set<String> = []
    /// 同步中又来了新信号 → 标记，本轮结束后再补一轮
    private var pendingResync: Set<String> = []

    /// 消息变更回调（UI 层订阅刷新）。返回该群最新本地消息列表。
    public var onGroupChanged: ((_ groupId: String) -> Void)?

    public init(
        store: ChatMessageStore,
        transport: ChatTransport = NetworkChatTransport(),
        uploader: ChatMediaUploader = NetworkChatMediaUploader(),
        currentUserId: @escaping () -> String?
    ) {
        self.store = store
        self.transport = transport
        self.uploader = uploader
        self.currentUserId = currentUserId
    }

    public func setOnGroupChanged(_ cb: @escaping (String) -> Void) {
        self.onGroupChanged = cb
    }

    // MARK: - 发送

    /// 发送文本/语音/图片。乐观上屏 → 幂等发送 → 确认或标红。
    @discardableResult
    public func send(groupId: String, type: ChatMessageType, content: String?, payload: [String: JSONValue]? = nil) async -> ChatMessage {
        let clientMsgId = UUID().uuidString
        let optimistic = ChatMessage(
            id: "local:\(clientMsgId)",
            groupId: groupId,
            seq: 0,
            senderId: currentUserId(),
            type: type,
            content: content,
            payload: payload.map { ChatPayload($0) },
            eventId: nil,
            clientMsgId: clientMsgId,
            status: "normal",
            version: 1,
            createdAt: Date(),
            sendState: .sending
        )
        await store.insertOptimistic(optimistic)
        onGroupChanged?(groupId)

        let body = ChatSendRequest(clientMsgId: clientMsgId, type: type.rawValue, content: content, payload: payload)
        do {
            let server = try await withRetry(times: 3) {
                try await self.transport.send(groupId: groupId, body: body)
            }
            await store.confirmOptimistic(clientMsgId: clientMsgId, with: server)
            onGroupChanged?(groupId)
            return server
        } catch {
            await store.markFailed(clientMsgId: clientMsgId)
            onGroupChanged?(groupId)
            var failed = optimistic
            failed.sendState = .failed   // 返回值与 store 状态一致，避免调用方拿到过期 .sending
            return failed
        }
    }

    /// 发送语音：先落乐观消息（payload 暂存本地文件路径）→ 上传 → 发送。
    ///
    /// 2026-09-07 复核：原先是"先上传成功才有消息"，上传失败直接删文件返回 nil，
    /// 老人在弱网下录的 30 秒语音会静默消失，与文本消息"标红可重发"的体验不一致。
    /// 现在失败也留下一条可重发的红点气泡，本地文件保留供重传。
    @discardableResult
    public func sendVoice(groupId: String, fileURL: URL, duration: Int, transcript: String) async -> ChatMessage {
        let clientMsgId = UUID().uuidString
        var payload: [String: JSONValue] = [
            Self.localPathKey: .string(fileURL.path),
            "duration": .number(Double(duration)),
            "transcript": .string(transcript),
        ]
        let optimistic = ChatMessage(
            id: "local:\(clientMsgId)", groupId: groupId, seq: 0, senderId: currentUserId(),
            type: .voice, content: transcript.isEmpty ? nil : transcript,
            payload: ChatPayload(payload), eventId: nil, clientMsgId: clientMsgId,
            status: "normal", version: 1, createdAt: Date(), sendState: .sending
        )
        await store.insertOptimistic(optimistic)
        onGroupChanged?(groupId)

        do {
            let url = try await uploadMediaFile(.voice, fileURL)
            payload["url"] = .string(url)
            payload.removeValue(forKey: Self.localPathKey)   // 上传成功，本地路径不再需要
            let body = ChatSendRequest(clientMsgId: clientMsgId, type: ChatMessageType.voice.rawValue,
                                       content: optimistic.content, payload: payload)
            let server = try await withRetry(times: 3) {
                try await self.transport.send(groupId: groupId, body: body)
            }
            await store.confirmOptimistic(clientMsgId: clientMsgId, with: server)
            onGroupChanged?(groupId)
            try? FileManager.default.removeItem(at: fileURL)
            return server
        } catch {
            // 保留本地文件：重发时还要用它重新上传
            await store.markFailed(clientMsgId: clientMsgId)
            onGroupChanged?(groupId)
            var failed = optimistic
            failed.sendState = .failed
            return failed
        }
    }

    /// 发图片：与语音相同的「乐观上屏 → 上传 → 发送」。
    /// 2026-10-06：原来先上传再上屏，选完图要等上传结束才看到气泡（用户以为点了没反应）。
    /// fileURL 是已压缩好的 JPEG（放在 outbox 目录），payload 先带本地路径，气泡直接显示本地图。
    public func sendImage(groupId: String, fileURL: URL, width: Int, height: Int) async -> ChatMessage {
        let clientMsgId = UUID().uuidString
        var payload: [String: JSONValue] = [
            Self.localPathKey: .string(fileURL.path),
            "w": .number(Double(width)),
            "h": .number(Double(height)),
        ]
        let optimistic = ChatMessage(
            id: "local:\(clientMsgId)", groupId: groupId, seq: 0, senderId: currentUserId(),
            type: .image, content: nil,
            payload: ChatPayload(payload), eventId: nil, clientMsgId: clientMsgId,
            status: "normal", version: 1, createdAt: Date(), sendState: .sending
        )
        await store.insertOptimistic(optimistic)
        onGroupChanged?(groupId)

        do {
            let url = try await uploadMediaFile(.image, fileURL)
            payload["url"] = .string(url)
            payload.removeValue(forKey: Self.localPathKey)
            let body = ChatSendRequest(clientMsgId: clientMsgId, type: ChatMessageType.image.rawValue,
                                       content: nil, payload: payload)
            // 先写缓存再确认：确认后气泡立刻切到远端 url，此时缓存必须已就绪，否则又去 CDN 下载
            Self.cacheSentImage(fileURL, url: url)
            let server = try await withRetry(times: 3) {
                try await self.transport.send(groupId: groupId, body: body)
            }
            await store.confirmOptimistic(clientMsgId: clientMsgId, with: server)
            onGroupChanged?(groupId)
            try? FileManager.default.removeItem(at: fileURL)
            return server
        } catch {
            await store.markFailed(clientMsgId: clientMsgId)
            onGroupChanged?(groupId)
            var failed = optimistic
            failed.sendState = .failed
            return failed
        }
    }

    /// 自己发的图：上传成功后把本地文件存进 ChatImageCache（按远端 url），
    /// 气泡切到远端 url 时直接命中缓存，不用再从 CDN 下载一遍。
    /// outbox 文件由调用方在发送成功后删除（发送失败还要留着重发）。
    private static func cacheSentImage(_ fileURL: URL, url: String) {
        if let data = try? Data(contentsOf: fileURL), let img = UIImage(data: data) {
            ChatImageCache.shared.setImage(img, forKey: url)
        }
    }

    /// payload 里存的是绝对路径，而 App 更新后沙盒容器路径会变：原路径不存在时按文件名到 Caches/ChatOutbox 下找
    nonisolated static func resolveLocalFile(_ path: String) -> URL {
        let url = URL(fileURLWithPath: path)
        if FileManager.default.fileExists(atPath: url.path) { return url }
        if let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first {
            let alt = caches.appendingPathComponent("ChatOutbox").appendingPathComponent(url.lastPathComponent)
            if FileManager.default.fileExists(atPath: alt.path) { return alt }
        }
        return url
    }

    /// 读文件 + 上传（带退避重试）
    private func uploadMediaFile(_ type: ChatMessageType, _ fileURL: URL) async throws -> String {
        let data = try Data(contentsOf: fileURL)
        if type == .image {
            let filename = "img_\(UUID().uuidString).jpg"
            return try await withRetry(times: 2) {
                try await self.uploader.uploadImage(data: data, filename: filename)
            }
        }
        let filename = "voice_\(UUID().uuidString).m4a"
        return try await withRetry(times: 2) {
            try await self.uploader.uploadVoice(data: data, filename: filename)
        }
    }

    /// 重发一条失败的乐观消息（复用相同 clientMsgId，服务端幂等去重）
    @discardableResult
    public func resend(_ message: ChatMessage) async -> ChatMessage {
        guard let clientMsgId = message.clientMsgId, message.seq == 0 else { return message }

        // 语音/图片消息上次卡在"上传失败"：payload 里只有本地路径没有 url，必须先重新上传，
        // 否则重发的是一条没有地址的空消息（服务端 payload 校验也会拒绝）。
        var outgoingPayload = message.payload?.raw
        // 本地文件等发送确认后再删：store 里的 payload 仍只有本地路径，若这次发送失败，下次重发还要靠它重新上传
        var uploadedFile: URL?
        if message.type == .voice || message.type == .image,
           let localPath = message.payload?.string(Self.localPathKey),
           message.payload?.string("url") == nil {
            let fileURL = Self.resolveLocalFile(localPath)
            guard let url = try? await uploadMediaFile(message.type, fileURL) else {
                await store.markFailed(clientMsgId: clientMsgId)
                onGroupChanged?(message.groupId)
                var stillFailed = message
                stillFailed.sendState = .failed
                return stillFailed
            }
            var patched = message.payload?.raw ?? [:]
            patched["url"] = .string(url)
            patched.removeValue(forKey: Self.localPathKey)
            outgoingPayload = patched
            if message.type == .image { Self.cacheSentImage(fileURL, url: url) }
            uploadedFile = fileURL
        }

        let body = ChatSendRequest(clientMsgId: clientMsgId, type: message.type.rawValue,
                                   content: message.content, payload: outgoingPayload)
        do {
            let server = try await withRetry(times: 3) {
                try await self.transport.send(groupId: message.groupId, body: body)
            }
            await store.confirmOptimistic(clientMsgId: clientMsgId, with: server)
            onGroupChanged?(message.groupId)
            if let uploadedFile { try? FileManager.default.removeItem(at: uploadedFile) }
            return server
        } catch {
            await store.markFailed(clientMsgId: clientMsgId)
            onGroupChanged?(message.groupId)
            var failed = message
            failed.sendState = .failed
            return failed
        }
    }

    // MARK: - 接收 / 同步

    /// 增量同步：从本地 lastSeq 之后把服务端新消息拉全（分页直到追平）。
    /// 三条通道（WS new 信号 / APNs 点开 / 前台激活）都调用此方法，天然收敛。
    public func syncGroup(_ groupId: String) async {
        // 401 清 token 后不要继续空轮询（实测每 5s 一次无鉴权请求打到服务端）
        guard let token = AuthInterceptor.token(), !token.isEmpty else { return }
        if syncing.contains(groupId) {
            pendingResync.insert(groupId)   // 正在同步，记一笔，结束后补一轮
            return
        }
        syncing.insert(groupId)
        defer { syncing.remove(groupId) }

        do {
            var changed = false
            if await store.localLastSeq(groupId: groupId) == 0 {
                // 2026-09-07 复核：本地空库（新装机 / 清缓存 / 换账号）时原来会从 seq=0
                // 逐页追平整个群历史，5000 条的群 = 100 次请求且全量落库。
                // 改为只拉最近一页，更早的消息由 loadHistory 向上翻页按需加载。
                let resp = try await transport.pull(groupId: groupId, afterSeq: nil, beforeSeq: nil,
                                                    limit: Self.firstSyncPageSize)
                if !resp.messages.isEmpty {
                    await store.upsert(resp.messages)
                    changed = true
                }
            } else {
                while true {
                    let after = await store.localLastSeq(groupId: groupId)
                    let resp = try await transport.pull(groupId: groupId, afterSeq: after, beforeSeq: nil, limit: 50)
                    if resp.messages.isEmpty { break }
                    await store.upsert(resp.messages)
                    changed = true
                    if resp.messages.count < 50 { break }  // 已追平
                }
            }
            if changed { onGroupChanged?(groupId) }
        } catch {
            // 同步失败静默：下次信号/激活/轮询会再试（拉为主，不阻断）
        }

        // 同步期间又来了信号 → 补一轮
        if pendingResync.remove(groupId) != nil {
            await syncGroup(groupId)
        }
    }

    /// 向上翻历史（早于 beforeSeq 的 limit 条）
    @discardableResult
    public func loadHistory(groupId: String, beforeSeq: Int64, limit: Int = 30) async -> [ChatMessage] {
        do {
            let resp = try await transport.pull(groupId: groupId, afterSeq: nil, beforeSeq: beforeSeq, limit: limit)
            if !resp.messages.isEmpty {
                await store.upsert(resp.messages)
                onGroupChanged?(groupId)
            }
            return resp.messages
        } catch {
            return []
        }
    }

    /// 处理 WebSocket 下行信号
    public func handleSignal(_ signal: ChatSignal) async {
        switch signal {
        case .new(let groupId, _):
            await syncGroup(groupId)
        case .update(let groupId, _, _):
            await syncGroup(groupId)   // 卡片更新也走增量（version 变化会覆盖）
        case .recall(let groupId, let messageId):
            await store.markRecalled(messageId: messageId)
            onGroupChanged?(groupId)
        case .read:
            // 他人已读：Sprint 0 暂不落库对方游标，UI 层可后续接入
            break
        case .ready, .error, .unknown:
            break
        }
    }

    // MARK: - 已读

    /// 推进已读游标（本地立即更新 + 上报服务端；节流由调用方/UI 控制）
    public func markRead(groupId: String, upToSeq seq: Int64) async {
        let state = await store.syncState(groupId: groupId)
        guard seq > state.lastReadSeq else { return }
        await store.setLastReadSeq(groupId: groupId, seq: seq)
        _ = try? await transport.setReadCursor(groupId: groupId, seq: seq)
    }

    // MARK: - 撤回

    public func recall(groupId: String, messageId: String) async -> Bool {
        do {
            _ = try await transport.recall(groupId: groupId, messageId: messageId)
            await store.markRecalled(messageId: messageId)
            onGroupChanged?(groupId)
            return true
        } catch {
            return false
        }
    }

    // MARK: - 读取（供 UI）

    public func currentMessages(groupId: String, limit: Int = 200) async -> [ChatMessage] {
        await store.messages(groupId: groupId, limit: limit)
    }

    // MARK: - 工具

    /// 指数退避重试（1/2/4s 封顶）
    private func withRetry<T>(times: Int, _ op: @escaping () async throws -> T) async throws -> T {
        var lastError: Error?
        for attempt in 0...times {
            do { return try await op() }
            catch {
                lastError = error
                if attempt == times { break }
                let backoffMs = UInt64(min(4000, 1000 * (1 << attempt)))
                try? await Task.sleep(nanoseconds: backoffMs * 1_000_000)
            }
        }
        throw lastError ?? CancellationError()
    }
}
