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
    /// 我开启了聊天免打扰的群（切换 sheet / 角标渲染小红点）
    @Published public private(set) var mutedGroups: Set<String> = []
    /// 每群各成员已读游标（§7-4 已读名单）：groupId → (userId → lastReadSeq)
    @Published public private(set) var readStatesByGroup: [String: [String: Int64]] = [:]

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

    /// 每群当前已加载到内存的消息条数上限（向上翻页时逐页放大）。
    /// 2026-09-07 复核：原来固定 300 条且没有任何地方调 loadHistory，
    /// 导致 300 条以前的历史即使在库里也永远看不到。
    private var loadedLimitByGroup: [String: Int] = [:]
    private static let initialWindow = 300

    /// 本地库属于哪个账号（换账号必须清库，否则跨账号看到上一个人的家庭消息）
    private static let lastUserIdKey = "isitsafe.chat.lastUserId"

    /// 串行化所有"清库"类操作，保证它们不会与随后的同步任务乱序执行
    private var maintenance: Task<Void, Never>?

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
        // ① 换账号检测：本地库全账号共用一个文件，登录者变了就必须先清干净。
        //    否则 started 仍为 true → 跳过 refreshUnreadFromServer（本地游标恒为 0，
        //    历史全算未读 99+）、WS 仍绑着上一个账号的 token、列表里还是上一个人的消息。
        let currentUser = TokenStore.shared.userId
        let previousUser = UserDefaults.standard.string(forKey: Self.lastUserIdKey)
        if let currentUser, let previousUser, previousUser != currentUser {
            resetLocalState(clearIdentity: false)
        }
        if let currentUser { UserDefaults.standard.set(currentUser, forKey: Self.lastUserIdKey) }

        // ② 群列表同步落定：hasFamily / primaryGroupId 对调用方必须立即可见，
        //    不能推迟到下面的 Task 里（"发到家庭群"按钮会立刻读它）
        applyGroupList(groupIds)

        Task { await startInternal() }
    }

    private func startInternal() async {
        // 等清库类操作全部落地，避免它们与随后的同步竞争把新拉的数据又抹掉
        await maintenance?.value

        ws.connect()   // 幂等；换账号后此处会用新 token 重新握手
        guard !started else {
            await syncAllGroups()
            return
        }
        started = true
        await store.resetStuckSending()   // 清扫上次被杀进程留下的"发送中"僵尸消息
        await refreshUnreadFromServer()
        await syncAllGroups()
    }

    /// 更新我所属的群列表（切换/加入/退出家庭后）
    public func setGroups(_ ids: [String]) {
        applyGroupList(ids)
        Task { await syncAllGroups() }
    }

    /// 用最新群列表覆盖本地状态，并清理已不属于我的群
    private func applyGroupList(_ ids: [String]) {
        let removed = Set(groupIds).subtracting(ids)
        groupIds = ids
        guard !removed.isEmpty else { return }
        // 2026-09-07 复核：退群/群解散后，unreadByGroup 里的旧条目从不被删除，
        // 角标一直把已退出的群算进去，直到冷启动才恢复。
        for gid in removed {
            unreadByGroup.removeValue(forKey: gid)
            messagesByGroup.removeValue(forKey: gid)
            readStatesByGroup.removeValue(forKey: gid)
            loadedLimitByGroup.removeValue(forKey: gid)
            mutedGroups.remove(gid)
        }
        totalUnread = unreadByGroup.values.reduce(0, +)
        enqueueStoreMaintenance { store in
            for gid in removed { await store.deleteGroup(groupId: gid) }
        }
    }

    /// 把清库类操作串成一条链，保证彼此有序、且可被 startInternal await 到
    private func enqueueStoreMaintenance(_ work: @escaping (ChatMessageStore) async -> Void) {
        let previous = maintenance
        let store = self.store
        maintenance = Task { @MainActor in
            await previous?.value
            await work(store)
        }
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
                mutedGroups = Set(items.filter { $0.muted }.map { $0.groupId })
                start(groupIds: ids)
            } catch {
                // 无家庭/网络失败：忽略
            }
        }
    }

    /// 登出清理。由 `UserSessionStore.clearSession()` 统一调用，
    /// 覆盖主动登出、删账号、以及 401 被动清 session 三条路径。
    public func stop() {
        resetLocalState(clearIdentity: true)
    }

    /// 断连 + 清空内存态 + 排队清本地库。
    /// - Parameter clearIdentity: 登出时连"本地库属于谁"的标记一起清；
    ///   换账号场景传 false，由 start() 紧接着写入新 userId。
    private func resetLocalState(clearIdentity: Bool) {
        started = false
        ws.disconnect()
        stopPolling()
        groupIds = []
        messagesByGroup = [:]
        unreadByGroup = [:]
        totalUnread = 0
        mutedGroups = []
        readStatesByGroup = [:]
        blockedUserIds = []
        loadedLimitByGroup = [:]
        if clearIdentity {
            UserDefaults.standard.removeObject(forKey: Self.lastUserIdKey)
        }
        // 本地消息库全账号共用一个文件，必须清空，否则下一个登录者能看到上一个账号的家庭聊天
        enqueueStoreMaintenance { store in await store.clearAll() }
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

    /// 向上翻历史（指定锚点）。拉到的消息会进入 `messagesByGroup`（窗口同步放大）。
    @discardableResult
    public func loadHistory(groupId: String, beforeSeq: Int64, limit: Int = 30) async -> [ChatMessage] {
        let fetched = await engine.loadHistory(groupId: groupId, beforeSeq: beforeSeq, limit: limit)
        growWindow(groupId: groupId, by: limit)
        await reloadMessages(groupId: groupId)
        return fetched
    }

    /// 向上翻一页历史（推荐给列表用：自己算锚点，不需要调用方关心 seq）。
    /// 2026-09-07 复核：此前 loadHistory 全工程无调用者，且内存窗口固定 300 条，
    /// 300 条以前的消息即使已在本地库里也永远滚不出来。
    /// - Returns: 是否还可能有更早的消息（false = 已到群聊开头）
    @discardableResult
    public func loadOlderMessages(groupId: String, pageSize: Int = 30) async -> Bool {
        // 锚点取当前列表里最早一条"已确认"消息；乐观消息 seq=0 不能当锚点
        guard let oldestSeq = messagesByGroup[groupId]?.first(where: { $0.seq > 0 })?.seq else {
            return false
        }
        guard oldestSeq > 1 else { return false }   // 已经是群里第一条
        let fetched = await engine.loadHistory(groupId: groupId, beforeSeq: oldestSeq, limit: pageSize)
        // 即使这次没拉到新消息，也要放大窗口：更早的消息可能已在本地库、只是没进内存列表
        growWindow(groupId: groupId, by: pageSize)
        await reloadMessages(groupId: groupId)
        return !fetched.isEmpty
    }

    private func growWindow(groupId: String, by delta: Int) {
        loadedLimitByGroup[groupId] = (loadedLimitByGroup[groupId] ?? Self.initialWindow) + max(0, delta)
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
    ///
    /// 2026-09-07 复核：原来是"先发文本再写状态"，处置请求失败时文本已经发出去了，
    /// 用户重试会在群里重复刷同一句预设话。改为处置成功才发文本。
    @discardableResult
    public func handleEvent(eventId: String, groupId: String, action: String, presetText: String) async -> Bool {
        struct Req: Encodable { let action: String }
        struct Resp: Decodable { let status: String }
        do {
            let _: Resp = try await NetworkManager.shared.request(
                endpoint: .familyEventHandle(eventId: eventId), body: Req(action: action)
            )
        } catch {
            return false   // 状态没写成，不发文本，让 UI 可以提示重试
        }
        await engine.send(groupId: groupId, type: .text, content: presetText)
        // 拉一次，卡片横幅状态随之更新
        await syncGroupPublic(groupId)
        return true
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

    /// 发语音：结束录音 → 乐观上屏 → 上传 → 发送。
    /// 上传失败会留下一条红点消息（本地文件保留），点重发即可重新上传，
    /// 不再像旧实现那样把老人录好的语音悄悄删掉。
    /// - Returns: false 表示录音本身无效（时长过短 / 取不到文件），UI 可提示"说话时间太短"
    @discardableResult
    public func sendVoice(groupId: String) async -> Bool {
        guard let recorded = await VoiceMessageComposer.shared.finishRecording() else { return false }
        await engine.sendVoice(groupId: groupId, fileURL: recorded.fileURL,
                               duration: recorded.duration, transcript: recorded.transcript)
        return true
    }

    /// 进入某群时调用：立即同步 + 全部标已读 + 拉取成员已读游标（§7-4）
    public func enterGroup(_ groupId: String) {
        Task {
            await engine.syncGroup(groupId)
            await reloadMessages(groupId: groupId)
            if let last = messagesByGroup[groupId]?.last(where: { $0.seq > 0 })?.seq {
                await markRead(groupId: groupId, upToSeq: last)
            }
            await fetchReadStates(groupId)
        }
    }

    // MARK: - §7-4 已读名单 + 群聊免打扰

    /// 拉取该群各成员已读游标（进群时校准；之后靠 WS read 信号增量更新）
    public func fetchReadStates(_ groupId: String) async {
        guard let states: [ChatReadState] = try? await NetworkManager.shared.request(
            endpoint: .chatReadStates(groupId: groupId)
        ) else { return }
        var map: [String: Int64] = [:]
        for s in states { map[s.userId] = s.lastReadSeq }
        readStatesByGroup[groupId] = map
    }

    /// WS read 信号：对方已读游标只增
    private func applyReadSignal(groupId: String, userId: String, seq: Int64) {
        var map = readStatesByGroup[groupId] ?? [:]
        if seq > (map[userId] ?? 0) {
            map[userId] = seq
            readStatesByGroup[groupId] = map
        }
    }

    /// 已读到某 seq 的成员 userId（排除自己），供"女儿已读"渲染
    public func readers(groupId: String, seq: Int64, excluding selfId: String?) -> [String] {
        guard seq > 0, let states = readStatesByGroup[groupId] else { return [] }
        return states.compactMap { (uid, readSeq) in
            (uid != selfId && readSeq >= seq) ? uid : nil
        }
    }

    public func isMuted(_ groupId: String) -> Bool { mutedGroups.contains(groupId) }

    /// 设置我在某群的聊天免打扰
    @discardableResult
    public func setChatMute(groupId: String, muted: Bool) async -> Bool {
        struct Req: Encodable { let muted: Bool }
        struct Resp: Decodable { let muted: Bool }
        do {
            let r: Resp = try await NetworkManager.shared.request(
                endpoint: .chatSetMute(groupId: groupId), body: Req(muted: muted)
            )
            if r.muted { mutedGroups.insert(groupId) } else { mutedGroups.remove(groupId) }
            return true
        } catch {
            return false
        }
    }

    /// 前台激活：连 WS + 全量补齐 + 起轮询兜底
    public func appDidBecomeActive() {
        guard started else { return }
        ws.connect()
        Task { await syncAllGroups() }
        startPollingIfNeeded()
    }

    /// 进后台：停轮询（省电）+ 主动断开 WS。
    ///
    /// 2026-09-07 复核：iOS 挂起 App 时 socket 不发 FIN，服务端要等心跳超时（最长 ~90s）
    /// 才认定离线，这段窗口里发给我的消息会写进僵尸连接并**跳过 APNs 推送**，
    /// 老人什么都收不到。主动断开让服务端立刻走离线推送路径。
    /// 顺带修掉一个隐患：挂起后 task 仍非 nil，回前台 connect() 会因 `task == nil` 判定
    /// 而不重连，长连接实际已死。
    public func appDidEnterBackground() {
        stopPolling()
        ws.disconnect()
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
            mutedGroups = Set(items.filter { $0.muted }.map { $0.groupId })
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
            // §7-4 已读名单：他人已读游标更新，实时刷新"女儿已读"（引擎只处理消息，不落对方游标）
            if case let .read(groupId, userId, seq) = signal {
                Task { @MainActor in self?.applyReadSignal(groupId: groupId, userId: userId, seq: seq) }
            }
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
        let limit = loadedLimitByGroup[groupId] ?? Self.initialWindow
        let msgs = await engine.currentMessages(groupId: groupId, limit: limit)
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
