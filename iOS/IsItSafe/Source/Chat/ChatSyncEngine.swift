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

/// 传输层抽象（便于把引擎与 NetworkManager 解耦、可单测）
public protocol ChatTransport: Sendable {
    func send(groupId: String, body: ChatSendRequest) async throws -> ChatMessage
    func pull(groupId: String, afterSeq: Int64?, beforeSeq: Int64?, limit: Int?) async throws -> ChatPullResponse
    func setReadCursor(groupId: String, seq: Int64) async throws -> ChatReadCursorResponse
    func recall(groupId: String, messageId: String) async throws -> ChatMessage
}

/// 用 NetworkManager 实现的传输层
public struct NetworkChatTransport: ChatTransport {
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

/// 增量同步引擎（actor 保证并发安全）
public actor ChatSyncEngine {
    private let store: ChatMessageStore
    private let transport: ChatTransport
    private let currentUserId: () -> String?

    /// 每群一把"同步中"标志，避免同一群并发拉取造成乱序
    private var syncing: Set<String> = []
    /// 同步中又来了新信号 → 标记，本轮结束后再补一轮
    private var pendingResync: Set<String> = []

    /// 消息变更回调（UI 层订阅刷新）。返回该群最新本地消息列表。
    public var onGroupChanged: ((_ groupId: String) -> Void)?

    public init(
        store: ChatMessageStore,
        transport: ChatTransport = NetworkChatTransport(),
        currentUserId: @escaping () -> String?
    ) {
        self.store = store
        self.transport = transport
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

    /// 重发一条失败的乐观消息（复用相同 clientMsgId，服务端幂等去重）
    @discardableResult
    public func resend(_ message: ChatMessage) async -> ChatMessage {
        guard let clientMsgId = message.clientMsgId, message.seq == 0 else { return message }
        let body = ChatSendRequest(clientMsgId: clientMsgId, type: message.type.rawValue,
                                   content: message.content, payload: message.payload?.raw)
        do {
            let server = try await withRetry(times: 3) {
                try await self.transport.send(groupId: message.groupId, body: body)
            }
            await store.confirmOptimistic(clientMsgId: clientMsgId, with: server)
            onGroupChanged?(message.groupId)
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
        if syncing.contains(groupId) {
            pendingResync.insert(groupId)   // 正在同步，记一笔，结束后补一轮
            return
        }
        syncing.insert(groupId)
        defer { syncing.remove(groupId) }

        do {
            var changed = false
            while true {
                let after = await store.localLastSeq(groupId: groupId)
                let resp = try await transport.pull(groupId: groupId, afterSeq: after, beforeSeq: nil, limit: 50)
                if resp.messages.isEmpty { break }
                await store.upsert(resp.messages)
                changed = true
                if resp.messages.count < 50 { break }  // 已追平
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
