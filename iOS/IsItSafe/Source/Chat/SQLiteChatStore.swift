//
//  SQLiteChatStore.swift
//  IsItSafe
//
//  V5.1 自建 IM 本地消息持久化（裸 SQLite3，零第三方依赖）。
//  实现 ChatMessageStore 协议；决策点 #4 选"零依赖"路线，若日后换 GRDB 只需另写一个实现。
//
//  线程安全：actor 串行化所有访问，单个 sqlite3 连接只在本 actor 内使用。
//

import Foundation
import SQLite3

/// SQLite 传入字符串需拷贝，用 TRANSIENT
private let SQLITE_TRANSIENT = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

public actor SQLiteChatStore: ChatMessageStore {
    private var db: OpaquePointer?
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    /// - Parameter filename: 数据库文件名（默认放 Application Support）
    public init(filename: String = "family_chat.sqlite") {
        let dir = FileManager.default
            .urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let url = dir.appendingPathComponent(filename)
        // 用本地 handle 打开，再赋给 isolated 属性，避免对 actor 属性取 inout；
        // 建表全走 nonisolated 的 sqlite3_exec，不触碰 actor 隔离方法（Swift 6 友好）
        var handle: OpaquePointer?
        if sqlite3_open_v2(url.path, &handle, SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX, nil) != SQLITE_OK {
            #if DEBUG
            print("[ChatDB] open failed")
            #endif
        }
        Self.bootstrap(handle)
        self.db = handle
    }

    deinit {
        if let db { sqlite3_close_v2(db) }
    }

    // MARK: - schema（nonisolated：仅用 C 函数，不碰 actor 状态）

    private nonisolated static func bootstrap(_ db: OpaquePointer?) {
        let stmts = [
            "PRAGMA journal_mode=WAL;",
            "PRAGMA foreign_keys=ON;",
            """
            CREATE TABLE IF NOT EXISTS messages (
              id TEXT PRIMARY KEY,
              group_id TEXT NOT NULL,
              seq INTEGER NOT NULL,
              sender_id TEXT,
              type TEXT NOT NULL,
              content TEXT,
              payload_json TEXT,
              event_id TEXT,
              client_msg_id TEXT,
              status TEXT NOT NULL DEFAULT 'normal',
              version INTEGER NOT NULL DEFAULT 1,
              created_at REAL NOT NULL,
              send_state TEXT
            );
            """,
            "CREATE INDEX IF NOT EXISTS idx_messages_group_seq ON messages(group_id, seq);",
            "CREATE INDEX IF NOT EXISTS idx_messages_client ON messages(group_id, client_msg_id);",
            """
            CREATE TABLE IF NOT EXISTS cursors (
              group_id TEXT PRIMARY KEY,
              last_read_seq INTEGER NOT NULL DEFAULT 0
            );
            """,
        ]
        for sql in stmts { sqlite3_exec(db, sql, nil, nil, nil) }
    }

    // MARK: - ChatMessageStore

    public func upsert(_ messages: [ChatMessage]) async {
        exec("BEGIN;")
        for m in messages {
            // 确认消息到来 → 清掉对应的乐观占位（同 client_msg_id 且 seq=0）
            if let cid = m.clientMsgId, m.seq > 0 {
                run("DELETE FROM messages WHERE group_id=? AND client_msg_id=? AND seq=0;") { st in
                    bindText(st, 1, m.groupId); bindText(st, 2, cid)
                }
            }
            insertOrReplace(m)
        }
        exec("COMMIT;")
    }

    public func insertOptimistic(_ message: ChatMessage) async {
        insertOrReplace(message)
    }

    public func confirmOptimistic(clientMsgId: String, with server: ChatMessage) async {
        exec("BEGIN;")
        run("DELETE FROM messages WHERE client_msg_id=? AND seq=0;") { st in
            bindText(st, 1, clientMsgId)
        }
        insertOrReplace(server)
        exec("COMMIT;")
    }

    public func markFailed(clientMsgId: String) async {
        run("UPDATE messages SET send_state='failed' WHERE client_msg_id=? AND seq=0;") { st in
            bindText(st, 1, clientMsgId)
        }
    }

    public func markRecalled(messageId: String) async {
        run("UPDATE messages SET status='recalled', content=NULL, payload_json=NULL WHERE id=?;") { st in
            bindText(st, 1, messageId)
        }
    }

    public func messages(groupId: String, limit: Int) async -> [ChatMessage] {
        // 取最新 limit 条：内层按 seq 降序（乐观 seq=0 视为最大排最前）取 N 条，
        // 外层再翻正为升序（已确认按 seq、乐观按时间排末尾）。
        // 注意：内层每个排序键都要显式 DESC，否则 DESC 只作用于最后一列 → 取成最旧 N 条。
        var rows: [ChatMessage] = []
        query("""
        SELECT * FROM (
          SELECT * FROM messages WHERE group_id=?
          ORDER BY (CASE WHEN seq=0 THEN 1 ELSE 0 END) DESC, seq DESC, created_at DESC
          LIMIT ?
        ) ORDER BY (CASE WHEN seq=0 THEN 1 ELSE 0 END), seq, created_at;
        """, bind: { st in
            bindText(st, 1, groupId); sqlite3_bind_int(st, 2, Int32(limit))
        }, each: { st in
            if let m = self.rowToMessage(st) { rows.append(m) }
        })
        return rows
    }

    public func localLastSeq(groupId: String) async -> Int64 {
        var maxSeq: Int64 = 0
        query("SELECT COALESCE(MAX(seq),0) FROM messages WHERE group_id=?;", bind: { st in
            bindText(st, 1, groupId)
        }, each: { st in
            maxSeq = sqlite3_column_int64(st, 0)
        })
        return maxSeq
    }

    public func syncState(groupId: String) async -> ChatSyncState {
        let last = await localLastSeq(groupId: groupId)
        var read: Int64 = 0
        query("SELECT last_read_seq FROM cursors WHERE group_id=?;", bind: { st in
            bindText(st, 1, groupId)
        }, each: { st in
            read = sqlite3_column_int64(st, 0)
        })
        return ChatSyncState(localLastSeq: last, lastReadSeq: read)
    }

    public func setLastReadSeq(groupId: String, seq: Int64) async {
        run("""
        INSERT INTO cursors(group_id, last_read_seq) VALUES(?, ?)
        ON CONFLICT(group_id) DO UPDATE SET last_read_seq=MAX(last_read_seq, excluded.last_read_seq);
        """) { st in
            bindText(st, 1, groupId); sqlite3_bind_int64(st, 2, seq)
        }
    }

    // MARK: - 生命周期维护（2026-09-07 复核新增）

    /// 登出 / 换账号：本地库文件全账号共用，不清空会跨账号泄露聊天记录
    public func clearAll() async {
        exec("BEGIN;")
        exec("DELETE FROM messages;")
        exec("DELETE FROM cursors;")
        exec("COMMIT;")
    }

    /// 退群 / 群解散：该群本地数据不再有意义，留着还会让角标一直不减
    public func deleteGroup(groupId: String) async {
        exec("BEGIN;")
        run("DELETE FROM messages WHERE group_id=?;") { st in bindText(st, 1, groupId) }
        run("DELETE FROM cursors WHERE group_id=?;") { st in bindText(st, 1, groupId) }
        exec("COMMIT;")
    }

    /// App 被杀时 send() 的 catch 不会执行，sending 行会永久留库（气泡永远转圈、
    /// 且 resend 只对 failed 行开放）。启动时把这些僵尸行改成 failed，让用户能重发。
    public func resetStuckSending() async {
        run("UPDATE messages SET send_state='failed' WHERE seq=0 AND send_state='sending';") { _ in }
    }

    // MARK: - 写入辅助

    private func insertOrReplace(_ m: ChatMessage) {
        run("""
        INSERT OR REPLACE INTO messages
          (id, group_id, seq, sender_id, type, content, payload_json, event_id, client_msg_id, status, version, created_at, send_state)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?);
        """) { st in
            bindText(st, 1, m.id)
            bindText(st, 2, m.groupId)
            sqlite3_bind_int64(st, 3, m.seq)
            bindTextOpt(st, 4, m.senderId)
            bindText(st, 5, m.type.rawValue)
            bindTextOpt(st, 6, m.content)
            bindTextOpt(st, 7, self.encodePayload(m.payload))
            bindTextOpt(st, 8, m.eventId)
            bindTextOpt(st, 9, m.clientMsgId)
            bindText(st, 10, m.status)
            sqlite3_bind_int(st, 11, Int32(m.version))
            sqlite3_bind_double(st, 12, m.createdAt.timeIntervalSince1970)
            bindTextOpt(st, 13, m.sendState?.rawValue)
        }
    }

    private func rowToMessage(_ st: OpaquePointer?) -> ChatMessage? {
        func col(_ i: Int32) -> String? {
            guard let c = sqlite3_column_text(st, i) else { return nil }
            return String(cString: c)
        }
        guard let id = col(0), let groupId = col(1), let type = col(4), let status = col(9) else { return nil }
        let seq = sqlite3_column_int64(st, 2)
        let payload = decodePayload(col(6))
        let createdAt = Date(timeIntervalSince1970: sqlite3_column_double(st, 11))
        let sendState = col(12).flatMap { ChatSendState(rawValue: $0) }
        return ChatMessage(
            id: id, groupId: groupId, seq: seq, senderId: col(3),
            type: ChatMessageType(rawValue: type) ?? .unknown,
            content: col(5), payload: payload, eventId: col(7), clientMsgId: col(8),
            status: status, version: Int(sqlite3_column_int(st, 10)),
            createdAt: createdAt, sendState: sendState
        )
    }

    private func encodePayload(_ p: ChatPayload?) -> String? {
        guard let p, let data = try? encoder.encode(p) else { return nil }
        return String(data: data, encoding: .utf8)
    }
    private func decodePayload(_ s: String?) -> ChatPayload? {
        guard let s, let data = s.data(using: .utf8) else { return nil }
        return try? decoder.decode(ChatPayload.self, from: data)
    }

    // MARK: - SQLite 低层封装

    @discardableResult
    private func exec(_ sql: String) -> Bool {
        sqlite3_exec(db, sql, nil, nil, nil) == SQLITE_OK
    }

    /// 执行一条无结果集语句（INSERT/UPDATE/DELETE）
    private func run(_ sql: String, bind: (OpaquePointer?) -> Void) {
        var st: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &st, nil) == SQLITE_OK else {
            #if DEBUG
            print("[ChatDB] prepare failed: \(lastError()) sql=\(sql)")
            #endif
            return
        }
        bind(st)
        if sqlite3_step(st) != SQLITE_DONE {
            #if DEBUG
            print("[ChatDB] step failed: \(lastError())")
            #endif
        }
        sqlite3_finalize(st)
    }

    /// 执行查询，对每行回调
    private func query(_ sql: String, bind: (OpaquePointer?) -> Void, each: (OpaquePointer?) -> Void) {
        var st: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &st, nil) == SQLITE_OK else {
            #if DEBUG
            print("[ChatDB] query prepare failed: \(lastError()) sql=\(sql)")
            #endif
            return
        }
        bind(st)
        while sqlite3_step(st) == SQLITE_ROW { each(st) }
        sqlite3_finalize(st)
    }

    private func lastError() -> String {
        guard let db, let c = sqlite3_errmsg(db) else { return "unknown" }
        return String(cString: c)
    }
}

// 绑定辅助（顶层函数，供 actor 内闭包调用）
private func bindText(_ st: OpaquePointer?, _ idx: Int32, _ value: String) {
    sqlite3_bind_text(st, idx, value, -1, SQLITE_TRANSIENT)
}
private func bindTextOpt(_ st: OpaquePointer?, _ idx: Int32, _ value: String?) {
    if let value { sqlite3_bind_text(st, idx, value, -1, SQLITE_TRANSIENT) }
    else { sqlite3_bind_null(st, idx) }
}
