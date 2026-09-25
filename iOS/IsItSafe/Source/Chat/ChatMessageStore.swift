//
//  ChatMessageStore.swift
//  IsItSafe
//
//  V5.1 自建 IM 本地消息存储抽象。
//
//  设计：ChatSyncEngine 只依赖本协议，不关心底层是内存还是 SQLite。
//  ┌ 决策点 #4（V5.1_自建IM技术方案.md §10）：持久化实现二选一 ┐
//  │  A. GRDBMessageStore —— 引入 GRDB(SPM)，成熟稳定（建议）        │
//  │  B. SQLiteMessageStore —— 裸 SQLite3，零依赖（+1d）            │
//  └ 二者都实现本协议即可无缝替换；当前 Sprint 0 用 InMemoryStore 验证同步逻辑 ┘
//

import Foundation

/// 每群同步锚点
public struct ChatSyncState: Equatable {
    public var localLastSeq: Int64      // 本地已落库的最大 seq
    public var lastReadSeq: Int64       // 我的已读游标
    public init(localLastSeq: Int64 = 0, lastReadSeq: Int64 = 0) {
        self.localLastSeq = localLastSeq
        self.lastReadSeq = lastReadSeq
    }
}

/// 本地消息存储。实现须线程安全（引擎在后台 actor 内调用）。
public protocol ChatMessageStore {
    /// 幂等 upsert 一批消息（按 id 覆盖；乐观消息被确认后用真实 id 替换 clientMsgId 占位）
    func upsert(_ messages: [ChatMessage]) async
    /// 插入一条乐观消息（本地发送、未确认）
    func insertOptimistic(_ message: ChatMessage) async
    /// 乐观消息被服务端确认：用 clientMsgId 定位，替换为服务端权威消息
    func confirmOptimistic(clientMsgId: String, with server: ChatMessage) async
    /// 标记乐观消息发送失败
    func markFailed(clientMsgId: String) async
    /// 撤回墓碑
    func markRecalled(messageId: String) async
    /// 取某群的本地消息（按 seq 升序，乐观消息排在末尾）
    func messages(groupId: String, limit: Int) async -> [ChatMessage]
    /// 某群本地最大已确认 seq（同步增量起点）
    func localLastSeq(groupId: String) async -> Int64
    /// 读取/写入同步状态
    func syncState(groupId: String) async -> ChatSyncState
    func setLastReadSeq(groupId: String, seq: Int64) async

    // MARK: - 生命周期维护（2026-09-07 复核新增）

    /// 清空全部本地消息与游标。
    /// 用于登出 / 换账号：本地库全账号共用一个文件，不清会让下一个登录者
    /// 看到上一个账号的家庭聊天记录，并把历史全部算成未读（99+）。
    func clearAll() async
    /// 删除某群的本地消息与游标（退群 / 群被解散后不能再留在本地）
    func deleteGroup(groupId: String) async
    /// 把"发送中"的僵尸乐观消息标成失败。
    /// send() 是先落 sending 再发网络，App 被杀时 catch 不会执行，
    /// 这行会以 sending 永久留在库里 → 气泡永远转圈且无法重发。启动时清扫一次。
    func resetStuckSending() async
}

/// Sprint 0 内存实现：验证同步引擎逻辑；持久化实现（GRDB/SQLite）落地后替换即可。
public actor InMemoryChatStore: ChatMessageStore {
    private var byGroup: [String: [ChatMessage]] = [:]
    private var readSeq: [String: Int64] = [:]

    public init() {}

    private func sorted(_ arr: [ChatMessage]) -> [ChatMessage] {
        // 排序键：已确认消息用 seq；未确认（seq=0）排到末尾，彼此按创建时间
        func key(_ m: ChatMessage) -> (Int64, Double) {
            let bucket: Int64 = m.seq == 0 ? Int64.max : m.seq
            return (bucket, m.createdAt.timeIntervalSince1970)
        }
        return arr.sorted { lhs, rhs in
            let a = key(lhs), b = key(rhs)
            if a.0 != b.0 { return a.0 < b.0 }
            return a.1 < b.1
        }
    }

    public func upsert(_ messages: [ChatMessage]) async {
        for m in messages {
            var list = byGroup[m.groupId] ?? []
            // 按 id 去重覆盖；同时清理被此消息确认的乐观占位（clientMsgId 相同）
            list.removeAll { $0.id == m.id || ($0.clientMsgId != nil && $0.clientMsgId == m.clientMsgId && $0.seq == 0) }
            list.append(m)
            byGroup[m.groupId] = sorted(list)
        }
    }

    public func insertOptimistic(_ message: ChatMessage) async {
        var list = byGroup[message.groupId] ?? []
        list.append(message)
        byGroup[message.groupId] = sorted(list)
    }

    public func confirmOptimistic(clientMsgId: String, with server: ChatMessage) async {
        var list = byGroup[server.groupId] ?? []
        list.removeAll { $0.clientMsgId == clientMsgId && $0.seq == 0 }
        list.removeAll { $0.id == server.id }
        list.append(server)
        byGroup[server.groupId] = sorted(list)
    }

    public func markFailed(clientMsgId: String) async {
        for (g, list) in byGroup {
            if let idx = list.firstIndex(where: { $0.clientMsgId == clientMsgId && $0.seq == 0 }) {
                var m = list[idx]; m.sendState = .failed
                var newList = list; newList[idx] = m
                byGroup[g] = newList
                return
            }
        }
    }

    public func markRecalled(messageId: String) async {
        for (g, list) in byGroup {
            if let idx = list.firstIndex(where: { $0.id == messageId }) {
                var m = list[idx]; m.status = "recalled"; m.content = nil; m.payload = nil
                var newList = list; newList[idx] = m
                byGroup[g] = newList
                return
            }
        }
    }

    public func messages(groupId: String, limit: Int) async -> [ChatMessage] {
        let list = byGroup[groupId] ?? []
        return Array(list.suffix(limit))
    }

    public func localLastSeq(groupId: String) async -> Int64 {
        (byGroup[groupId] ?? []).map { $0.seq }.max() ?? 0
    }

    public func syncState(groupId: String) async -> ChatSyncState {
        ChatSyncState(localLastSeq: await localLastSeq(groupId: groupId),
                      lastReadSeq: readSeq[groupId] ?? 0)
    }

    public func setLastReadSeq(groupId: String, seq: Int64) async {
        readSeq[groupId] = max(readSeq[groupId] ?? 0, seq)
    }

    public func clearAll() async {
        byGroup = [:]
        readSeq = [:]
    }

    public func deleteGroup(groupId: String) async {
        byGroup.removeValue(forKey: groupId)
        readSeq.removeValue(forKey: groupId)
    }

    public func resetStuckSending() async {
        for (g, list) in byGroup {
            byGroup[g] = list.map { m in
                guard m.seq == 0, m.sendState == .sending else { return m }
                var fixed = m; fixed.sendState = .failed; return fixed
            }
        }
    }
}
