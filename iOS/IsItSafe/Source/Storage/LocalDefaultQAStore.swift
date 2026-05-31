//
//  LocalDefaultQAStore.swift
//  IsItSafe
//
//  冷启动默认 3 组问答：完全本地展示，不上传服务器。
//  通过缓存文件判断：是否已展示过、是否用户已发过任何内容，以及默认会话的本地记录。
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

    private let fileName = "isitsafe.local_default_qa.json"
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    private init() {}

    private var fileURL: URL {
        let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
        return caches.appendingPathComponent(fileName)
    }

    private func loadState() -> LocalDefaultQAFileState {
        do {
            let data = try Data(contentsOf: fileURL)
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
        do {
            let data = try encoder.encode(state)
            // 原子写入，避免写一半导致 JSON 损坏
            try data.write(to: fileURL, options: [.atomic])
        } catch {
            // 写失败不影响主流程；下一次启动会回退为默认状态
        }
    }

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

    /// 切账号时清空：登入新用户 / 登出 / 删号都要调
    /// 否则老用户的"已展示"标记会让新用户看不到默认聊天
    public func resetForNewUser() {
        try? FileManager.default.removeItem(at: fileURL)
    }
}

