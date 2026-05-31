//
//  LocalDefaultQAStore.swift
//  IsItSafe
//
//  冷启动默认 3 组问答：完全本地展示，不上传服务器。
//  V2：按 userId 隔离存储，新用户独立判断 / 老用户保持已有状态。
//  匿名（未登录）用 "guest" 作为隔离 key。
//

import Foundation

public struct LocalDefaultConversationRecord: Codable, Equatable {
    public let localConversationId: String
    public let createdAtISO: String
    /// 当用户在默认对话内首次主动提问后，服务端会返回 conversationId，此处记录用于后续合并加载
    public var serverConversationId: String?
}

private struct LocalDefaultQAFileState: Codable {
    var hasShownDefaultQA: Bool
    var hasUserSentAnyContent: Bool
    var defaultConversation: LocalDefaultConversationRecord?
}

public final class LocalDefaultQAStore {
    public static let shared = LocalDefaultQAStore()

    /// 当前 userId（登入态决定，未登录用 "guest"）
    /// 通过 UserSessionStore 查询，避免环引
    private var currentUserId: String {
        UserSessionStore.shared.currentUser?.id ?? "guest"
    }

    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    private init() {}

    /// 按 userId 隔离文件路径
    /// 文件名格式：isitsafe.local_default_qa.{userId}.json
    private func fileURL(for userId: String) -> URL {
        let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
        // userId 是 cuid 格式，安全字符，直接拼即可
        let safe = userId.replacingOccurrences(of: "/", with: "_")
        return caches.appendingPathComponent("isitsafe.local_default_qa.\(safe).json")
    }

    private func loadState() -> LocalDefaultQAFileState {
        let url = fileURL(for: currentUserId)
        do {
            let data = try Data(contentsOf: url)
            return try decoder.decode(LocalDefaultQAFileState.self, from: data)
        } catch {
            return LocalDefaultQAFileState(
                hasShownDefaultQA: false,
                hasUserSentAnyContent: false,
                defaultConversation: nil
            )
        }
    }

    private func saveState(_ state: LocalDefaultQAFileState) {
        let url = fileURL(for: currentUserId)
        do {
            let data = try encoder.encode(state)
            try data.write(to: url, options: [.atomic])
        } catch {
            // 写失败不影响主流程
        }
    }

    /// 仅新用户（当前 userId 对应文件不存在 / hasShownDefaultQA=false）才显示
    /// 老用户登入会读到自己的旧文件 → 已显示过 → 不重复
    public func shouldShowDefaultQA() -> Bool {
        let state = loadState()
        return state.hasShownDefaultQA == false && state.hasUserSentAnyContent == false
    }

    public func markDefaultQAShown() {
        var state = loadState()
        state.hasShownDefaultQA = true
        saveState(state)
    }

    public func markUserSentAnyContent() {
        var state = loadState()
        state.hasUserSentAnyContent = true
        saveState(state)
    }

    public var defaultConversationRecord: LocalDefaultConversationRecord? {
        loadState().defaultConversation
    }

    public func saveDefaultConversationRecord(_ record: LocalDefaultConversationRecord) {
        var state = loadState()
        state.defaultConversation = record
        saveState(state)
    }

    public func clearDefaultConversationRecord() {
        var state = loadState()
        state.defaultConversation = nil
        saveState(state)
    }

    public func updateDefaultConversationServerId(_ serverConversationId: String) {
        var state = loadState()
        guard var rec = state.defaultConversation else { return }
        rec.serverConversationId = serverConversationId
        state.defaultConversation = rec
        saveState(state)
    }

    /// 删号时调用：直接物理删除该用户的本地文件
    /// 登出 / 普通登入不应该调
    public func deleteForCurrentUser() {
        try? FileManager.default.removeItem(at: fileURL(for: currentUserId))
    }
}
