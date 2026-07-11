//
//  FamilyChatCoordinator.swift
//  IsItSafe
//
//  V5.1 自建 IM 顶层协调器：串联 SQLite store + ChatSyncEngine + WebSocket 客户端，
//  向 SwiftUI 发布每群消息列表与未读数。App 与家庭层只跟本单例打交道。
//
//  收敛设计：WS 信号 / 前台激活 / 手动进群，三条通道都归并到 syncGroup；
//  WS 断线由前台轮询兜底，断→连时补一次全量 resync。
//

import Foundation
import Combine

@MainActor
public final class FamilyChatCoordinator: ObservableObject {
    public static let shared = FamilyChatCoordinator()

    /// 每群消息列表（已排序，供聊天页）
    @Published public private(set) var messagesByGroup: [String: [ChatMessage]] = [:]
    /// 每群未读数
    @Published public private(set) var unreadByGroup: [String: Int] = [:]
    /// 全部家庭未读之和（家庭 Tab 角标）
    @Published public private(set) var totalUnread: Int = 0
    /// WS 是否已连接（UI 可据此决定是否显示"连接中"）
    @Published public private(set) var isRealtimeConnected: Bool = false

    private let store: ChatMessageStore
    private let engine: ChatSyncEngine
    private let ws = ChatWebSocketClient()

    /// 我加入的家庭群 id（由家庭层 setGroups 注入；决定 resync/轮询范围）
    private var groupIds: [String] = []

    /// 是否已加入任一家庭（供"发到家庭群"按钮判断显示）
    public var hasFamily: Bool { !groupIds.isEmpty }
    /// 首选家庭群 id（发求助默认目标）
    public var primaryGroupId: String? { groupIds.first }
    private var started = false
    private var pollTimer: Timer?

    private init() {
        let store = SQLiteChatStore()
        self.store = store
        self.engine = ChatSyncEngine(store: store, currentUserId: { TokenStore.shared.userId })
        wireWebSocket()
        // 引擎回调是 actor 隔离的，异步设置
        Task { await wireEngine() }
    }

    // MARK: - 启停

    /// 登录后 / 家庭数据就绪后调用。可重复调用（幂等）。
    public func start(groupIds: [String]) {
        self.groupIds = groupIds
        guard !started else {
            Task { await self.syncAllGroups() }
            return
        }
        started = true
        ws.connect()
        Task {
            await refreshUnreadFromServer()
            await syncAllGroups()
        }
    }

    /// 更新我所属的群列表（切换/加入/退出家庭后）
    public func setGroups(_ ids: [String]) {
        self.groupIds = ids
        Task { await syncAllGroups() }
    }

    /// 登录态下从服务端自举群列表并启动（用于 App 激活时，不依赖是否进过家庭 Tab，
    /// 保证家庭 Tab 未读角标可用）。未登录 / 服务端未开启 IM 则忽略。
    public func bootstrapIfLoggedIn() {
        guard AppSettingsStore.familyChatEnabled else { return }  // 服务端未开启 → 不连 WS、不拉未读
        guard TokenStore.shared.userId != nil else { return }
        Task {
            do {
                let items: [ChatUnreadItem] = try await NetworkManager.shared.request(endpoint: .chatUnreadSummary)
                let ids = items.map { $0.groupId }
                var map: [String: Int] = [:]
                for it in items { map[it.groupId] = it.unread }
                unreadByGroup = map
                totalUnread = map.values.reduce(0, +)
                start(groupIds: ids)
            } catch {
                // 无家庭/网络失败：忽略
            }
        }
    }

    /// 登出清理
    public func stop() {
        started = false
        ws.disconnect()
        stopPolling()
        messagesByGroup = [:]
        unreadByGroup = [:]
        totalUnread = 0
    }

    // MARK: - 对外操作（代理到引擎）

    @discardableResult
    public func send(groupId: String, type: ChatMessageType, content: String?, payload: [String: JSONValue]? = nil) async -> ChatMessage {
        await engine.send(groupId: groupId, type: type, content: content, payload: payload)
    }

    @discardableResult
    public func resend(_ message: ChatMessage) async -> ChatMessage {
        await engine.resend(message)
    }

    public func markRead(groupId: String, upToSeq seq: Int64) async {
        await engine.markRead(groupId: groupId, upToSeq: seq)
        await recomputeUnread(groupId: groupId)
    }

    @discardableResult
    public func loadHistory(groupId: String, beforeSeq: Int64, limit: Int = 30) async -> [ChatMessage] {
        await engine.loadHistory(groupId: groupId, beforeSeq: beforeSeq, limit: limit)
    }

    public func recall(groupId: String, messageId: String) async -> Bool {
        await engine.recall(groupId: groupId, messageId: messageId)
    }

    /// 我屏蔽的用户 id（渲染层过滤）
    @Published public private(set) var blockedUserIds: Set<String> = []

    public func refreshBlocked() async {
        if let ids: [String] = try? await NetworkManager.shared.request(endpoint: .chatBlocked) {
            blockedUserIds = Set(ids)
        }
    }

    public func report(groupId: String, messageId: String, reason: String?) async {
        struct Req: Encodable { let groupId: String; let messageId: String; let reason: String? }
        struct Resp: Decodable { let success: Bool }
        _ = try? await NetworkManager.shared.request(
            endpoint: .chatReport, body: Req(groupId: groupId, messageId: messageId, reason: reason)
        ) as Resp
    }

    public func block(userId: String) async {
        struct Resp: Decodable { let success: Bool }
        _ = try? await NetworkManager.shared.request(endpoint: .chatBlock(userId: userId)) as Resp
        await refreshBlocked()
    }

    public func unblock(userId: String) async {
        struct Resp: Decodable { let success: Bool }
        _ = try? await NetworkManager.shared.request(endpoint: .chatUnblock(userId: userId)) as Resp
        await refreshBlocked()
    }

    // MARK: - 卡片流（求助 / 案例分享 / chips 处置）

    private struct EventEnvelope: Decodable {
        struct Ev: Decodable { let id: String }
        let event: Ev
    }

    /// 老人求助：把 AI 结论快照发进家庭群
    @discardableResult
    public func sendHelpRequest(groupId: String, title: String, summary: String?, riskLevel: String?, refType: String?, refId: String?) async -> Bool {
        struct Req: Encodable { let groupId: String; let title: String; let summary: String?; let riskLevel: String?; let refType: String?; let refId: String? }
        do {
            let _: EventEnvelope = try await NetworkManager.shared.request(
                endpoint: .familyHelpRequest,
                body: Req(groupId: groupId, title: title, summary: summary, riskLevel: riskLevel, refType: refType, refId: refId)
            )
            await syncGroupPublic(groupId)
            return true
        } catch { return false }
    }

    /// 案例/情报一键发家人
    @discardableResult
    public func shareCase(groupId: String, refType: String, refId: String, title: String, summary: String?, riskLevel: String?) async -> Bool {
        struct Req: Encodable { let groupId: String; let refType: String; let refId: String; let title: String; let summary: String?; let riskLevel: String? }
        do {
            let _: EventEnvelope = try await NetworkManager.shared.request(
                endpoint: .familyShareCase,
                body: Req(groupId: groupId, refType: refType, refId: refId, title: title, summary: summary, riskLevel: riskLevel)
            )
            await syncGroupPublic(groupId)
            return true
        } catch { return false }
    }

    /// chips 处置：写事件状态 + 同时发一条预设文本消息（双写，进周报口径）
    public func handleEvent(eventId: String, groupId: String, action: String, presetText: String) async {
        struct Req: Encodable { let action: String }
        struct Resp: Decodable { let status: String }
        // 发预设文本（走普通聊天，乐观上屏）
        await engine.send(groupId: groupId, type: .text, content: presetText)
        // 写处置状态
        _ = try? await NetworkManager.shared.request(
            endpoint: .familyEventHandle(eventId: eventId), body: Req(action: action)
        ) as Resp
        // 拉一次，卡片横幅状态随之更新
        await syncGroupPublic(groupId)
    }

    /// 供 UI 触发的公开增量同步
    public func syncGroupPublic(_ groupId: String) async {
        await engine.syncGroup(groupId)
        await reloadMessages(groupId: groupId)
        await recomputeUnread(groupId: groupId)
    }

    /// 发图片：先上传 R2，再发 image 消息（payload 带宽高，气泡占位不跳动）
    @discardableResult
    public func sendImage(groupId: String, imageData: Data, width: Int, height: Int) async -> ChatMessage? {
        do {
            let url = try await NetworkManager.shared.uploadFile(
                type: "family_image", imageData: imageData,
                mimeType: "image/jpeg", filename: "img_\(UUID().uuidString).jpg"
            )
            let payload: [String: JSONValue] = [
                "url": .string(url),
                "w": .number(Double(width)),
                "h": .number(Double(height)),
            ]
            return await engine.send(groupId: groupId, type: .image, content: nil, payload: payload)
        } catch {
            return nil
        }
    }

    /// 进入某群时调用：立即同步 + 全部标已读
    public func enterGroup(_ groupId: String) {
        Task {
            await engine.syncGroup(groupId)
            await reloadMessages(groupId: groupId)
            if let last = messagesByGroup[groupId]?.last(where: { $0.seq > 0 })?.seq {
                await markRead(groupId: groupId, upToSeq: last)
            }
        }
    }

    /// 前台激活：连 WS + 全量补齐 + 起轮询兜底
    public func appDidBecomeActive() {
        guard started else { return }
        ws.connect()
        Task { await syncAllGroups() }
        startPollingIfNeeded()
    }

    /// 进后台：停轮询（省电）；WS 由系统挂起
    public func appDidEnterBackground() {
        stopPolling()
    }

    // MARK: - 同步

    private func syncAllGroups() async {
        for gid in groupIds {
            await engine.syncGroup(gid)
            await reloadMessages(groupId: gid)
            await recomputeUnread(groupId: gid)
        }
    }

    /// 从服务端拉未读汇总（进入 App 时校准角标，不依赖本地是否已拉全消息）。
    /// 关键：把服务端的 lastReadSeq 播种进本地游标——否则本地游标恒为 0，
    /// 随后的 recomputeUnread 会把"历史全部消息"误算成未读（换机/清缓存后 99+）。
    private func refreshUnreadFromServer() async {
        do {
            let items: [ChatUnreadItem] = try await NetworkManager.shared.request(endpoint: .chatUnreadSummary)
            var map: [String: Int] = [:]
            for it in items {
                map[it.groupId] = it.unread
                // 本地游标只增，播种服务端已读位（setLastReadSeq 内部 max，不会倒退本地更新的已读）
                await store.setLastReadSeq(groupId: it.groupId, seq: it.lastReadSeq)
            }
            unreadByGroup = map
            totalUnread = map.values.reduce(0, +)
        } catch {
            // 失败静默：本地 recompute 会兜底
        }
    }

    // MARK: - 引擎/WS 接线

    private func wireEngine() async {
        // 引擎在 actor 内回调；跳回主线程刷新对应群
        await engine.setOnGroupChanged { [weak self] groupId in
            Task { @MainActor in
                await self?.reloadMessages(groupId: groupId)
                await self?.recomputeUnread(groupId: groupId)
            }
        }
    }

    private func wireWebSocket() {
        ws.onSignal = { [weak self] signal in
            Task { await self?.engine.handleSignal(signal) }
        }
        ws.onConnectedChange = { [weak self] connected in
            guard let self else { return }
            self.isRealtimeConnected = connected
            if connected {
                // 断→连：补齐断连期间漏收的消息
                Task { await self.syncAllGroups() }
                self.stopPolling()          // 有 WS 就不轮询
            } else {
                self.startPollingIfNeeded() // 掉线转轮询兜底
            }
        }
    }

    private func reloadMessages(groupId: String) async {
        let msgs = await engine.currentMessages(groupId: groupId, limit: 300)
        messagesByGroup[groupId] = msgs
    }

    private func recomputeUnread(groupId: String) async {
        let state = await store.syncState(groupId: groupId)
        let unread = max(0, Int(state.localLastSeq - state.lastReadSeq))
        unreadByGroup[groupId] = unread
        totalUnread = unreadByGroup.values.reduce(0, +)
    }

    // MARK: - 轮询兜底（WS 不可用时，前台每 5s 增量拉一次）

    private func startPollingIfNeeded() {
        guard started, pollTimer == nil else { return }
        let timer = Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { [weak self] _ in
            Task { @MainActor in await self?.syncAllGroups() }
        }
        pollTimer = timer
    }

    private func stopPolling() {
        pollTimer?.invalidate()
        pollTimer = nil
    }
}
