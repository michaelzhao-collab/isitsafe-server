//
//  HomeViewModel.swift
//  IsItSafe
//

import Combine
import Foundation
import SwiftUI
import UIKit

public final class HomeViewModel: ObservableObject {
    public static let minAnalyzingDuration: TimeInterval = 3

    @Published public var inputText = ""
    @Published public var pendingImage: UIImage?
    @Published public var turns: [ChatTurn] = []
    /// 收到回复后滚动到此 id，用于 ScrollViewReader
    @Published public var scrollToTurnId: UUID?
    /// 当前正在查看的历史记录 id（在首页打开某条历史时设置，新建对话时清空）
    @Published public var loadedHistoryId: String?
    /// 当前对话 id，同对话内连续提问时传服务端，历史按会话只显示一条；新建对话时清空
    @Published public var currentConversationId: String?
    /// 分析完成后递增，用于触发历史列表刷新（新对话记录已落库）
    @Published public var historyRefreshTrigger: Int = 0
    /// 每日免费次数用完：弹出订阅引导弹框
    @Published public var showDailyQuotaAlert = false

    @Published public var state: LoadableState<RiskAnalysisViewData> = .idle
    @Published public var queryRiskState: LoadableState<QueryRiskResponse> = .idle
    @Published public var lastResult: RiskAnalysisViewData?
    @Published public var lastQueryRisk: QueryRiskResponse?

    private let aiService = AIService.shared
    private let queryService = QueryService.shared
    private let appState = AppStateViewModel.shared

    public init() {}

    /// 加载「冷启动默认 3 组问答」的本地会话：
    /// - 无 serverConversationId：只展示 3 组本地问答
    /// - 有 serverConversationId：从服务端拉取该会话的用户主动提问/回复，并在最前面补上本地默认问答
    public func loadLocalDefaultConversation(_ record: LocalDefaultConversationRecord, languageCode: String) {
        // 基础状态重置（不影响输入框焦点控制）
        inputText = ""
        pendingImage = nil
        state = .loading
        queryRiskState = .idle
        lastResult = nil
        lastQueryRisk = nil

        loadedHistoryId = record.localConversationId
        currentConversationId = record.serverConversationId

        // 先快速渲染本地 3 组内容
        turns = LocalDefaultQAContent.defaultTurns(languageCode: languageCode)

        guard let serverId = record.serverConversationId, !serverId.isEmpty else {
            state = .idle
            return
        }

        Task {
            do {
                let messages = try await queryService.fetchHistoryByConversation(conversationId: serverId)
                let serverTurns: [ChatTurn] = messages.map { row in
                    let userText = row.content.trimmingCharacters(in: .whitespacesAndNewlines)
                    let result: ChatTurnResult
                    if let json = row.resultJson {
                        result = .analysis(RiskAnalysisViewData(from: json))
                    } else {
                        result = .failure("暂无结果")
                    }
                    return ChatTurn(
                        userText: userText.isEmpty ? nil : userText,
                        userImage: nil,
                        imageUrl: row.imageUrl,
                        status: .done(result)
                    )
                }

                await MainActor.run {
                    self.turns = LocalDefaultQAContent.defaultTurns(languageCode: languageCode) + serverTurns
                    self.state = .idle
                    self.queryRiskState = .idle
                    self.lastResult = nil
                    self.lastQueryRisk = nil
                }
            } catch {
                await MainActor.run {
                    self.state = .idle
                }
            }
        }
    }

    public func analyze() {
        let content = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !content.isEmpty else { return }
        guard !checkQuotaExhausted() else { return }
        LocalDefaultQAStore.shared.markUserSentAnyContent()
        appendTurn(userText: content, userImage: nil)
        inputText = ""
        runAnalysisForLastTurn(content: content, isScreenshot: false)
    }

    public func clearPendingImage() {
        pendingImage = nil
    }

    public func analyzeImage(_ image: UIImage) {
        guard !checkQuotaExhausted() else { pendingImage = nil; return }
        LocalDefaultQAStore.shared.markUserSentAnyContent()
        pendingImage = nil
        appendTurn(userText: nil, userImage: image)
        Task {
            let ocrText = await ImageOCR.recognize(from: image)
            await MainActor.run {
                if ocrText.isEmpty {
                    updateLastTurn(.analysis(RiskAnalysisViewData.imageContentNotRecognized))
                    return
                }
                runAnalysisForLastTurn(content: ocrText, isScreenshot: true)
            }
        }
    }

    /// 图片+文案：气泡内图上文下、左对齐；OCR 与文案合并后一起分析，结果结合后返回
    public func analyzeImageAndText(_ image: UIImage, text: String) {
        let userText = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !userText.isEmpty else { analyzeImage(image); return }
        guard !checkQuotaExhausted() else { pendingImage = nil; inputText = ""; return }
        LocalDefaultQAStore.shared.markUserSentAnyContent()
        pendingImage = nil
        inputText = ""
        appendTurn(userText: userText, userImage: image)
        Task {
            let ocrText = await ImageOCR.recognize(from: image)
            await MainActor.run {
                let combined: String
                if ocrText.isEmpty {
                    combined = userText
                } else {
                    combined = "【截图内容】\n\(ocrText)\n【用户补充】\n\(userText)"
                }
                runAnalysisForLastTurn(content: combined, isScreenshot: true)
            }
        }
    }

    public func analyzeScreenshot(ocrText: String) {
        guard !checkQuotaExhausted() else { return }
        LocalDefaultQAStore.shared.markUserSentAnyContent()
        appendTurn(userText: ocrText, userImage: nil)
        runAnalysisForLastTurn(content: ocrText, isScreenshot: true)
    }

    private func appendTurn(userText: String?, userImage: UIImage?) {
        turns.append(ChatTurn(userText: userText, userImage: userImage, status: .analyzing))
    }

    /// 非会员时检查今日免费次数是否耗尽；耗尽则弹框并返回 true
    @discardableResult
    private func checkQuotaExhausted() -> Bool {
        guard !appState.subscriptionActive else { return false }
        guard AppSettingsStore.shared.isFreeQuotaExhausted() else { return false }
        showDailyQuotaAlert = true
        return true
    }

    /// 取上一轮真实分析结果作为追问上下文（仅当上一轮是来自服务端的 is_conversational=false 结果时才注入）
    private func buildContext() -> [[String: String]]? {
        let prevIndex = turns.count - 2
        guard prevIndex >= 0 else { return nil }
        let prev = turns[prevIndex]
        guard case .done(let chatResult) = prev.status,
              case .analysis(let data) = chatResult,
              !data.isConversational,
              let cid = data.conversationId, !cid.isEmpty else { return nil }
        let _ = cid
        let userContent = prev.userText ?? "（图片分析）"
        let assistantContent = "[\(data.riskLevel)] \(data.summary)"
        return [
            ["role": "user", "content": userContent],
            ["role": "assistant", "content": assistantContent],
        ]
    }

    private func updateLastTurn(_ result: ChatTurnResult) {
        guard let idx = turns.indices.last else { return }
        let t = turns[idx]
        turns[idx] = ChatTurn(id: t.id, userText: t.userText, userImage: t.userImage, status: .done(result))
    }

    /// 统一走服务端 AI 分析：所有内容（文本/链接/电话/公司）都请求 POST /api/ai/analyze，
    /// 由服务端分类、风险库、RAG、豆包后返回完整 summary/reasons/advice，避免只走 query 导致无原因建议、无豆包日志。
    private func runAnalysisForLastTurn(content: String, isScreenshot: Bool) {
        let index = turns.count - 1
        let start = Date()
        Task {
            var imageUrl: String?
            let result: ChatTurnResult
            do {
                if isScreenshot {
                    let img = await MainActor.run { self.turns.indices.contains(index) ? self.turns[index].userImage : nil }
                    if let image = img, let data = image.jpegData(compressionQuality: 0.8) {
                        imageUrl = await UploadService.shared.uploadScreenshot(data, mimeType: "image/jpeg")
                    }
                }
                let cid = await MainActor.run { self.currentConversationId }
                let ctx = await MainActor.run { self.buildContext() }
                let viewData: RiskAnalysisViewData
                // 不传 language，由服务端根据用户输入内容自动判断：中文内容用中文回答，英文内容用英文回答
                if isScreenshot {
                    viewData = try await aiService.analyzeScreenshot(content: content, language: nil, imageUrl: imageUrl, conversationId: cid, context: ctx)
                } else {
                    viewData = try await aiService.analyzeText(content: content, language: nil, country: nil, conversationId: cid, context: ctx)
                }
                result = .analysis(viewData)
            } catch {
                if case APIError.tooManyRequests = error {
                    // 服务端兜底：本地计数未拦截到时（如多设备/清数据），仍弹框
                    await MainActor.run { self.showDailyQuotaAlert = true }
                    result = .failure("")
                } else {
                    result = .failure((error as? APIError)?.userMessage ?? error.localizedDescription)
                }
            }
            let elapsed = Date().timeIntervalSince(start)
            if elapsed < Self.minAnalyzingDuration {
                try? await Task.sleep(nanoseconds: UInt64((Self.minAnalyzingDuration - elapsed) * 1_000_000_000))
            }
            await MainActor.run {
                if index < self.turns.count {
                    let t = self.turns[index]
                    if let url = imageUrl, !url.isEmpty, let img = t.userImage {
                        ChatImageCache.shared.setImage(img, forKey: url)
                    }
                    // 为“历史回放不一定有 imageUrl”的情况做兜底缓存：
                    // 用 OCR/combined 文本当作缓存 key，这样二次进入对话时能从本地取回图片。
                    if isScreenshot, let img = t.userImage, !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        ChatImageCache.shared.setImage(img, forKey: content.trimmingCharacters(in: .whitespacesAndNewlines))
                    }
                    self.turns[index] = ChatTurn(id: t.id, userText: t.userText, userImage: t.userImage, imageUrl: imageUrl, status: .done(result))
                    self.scrollToTurnId = t.id
                }
                if case .analysis(let d) = result {
                    self.lastResult = d
                    self.state = .success(d)
                    // 非会员：成功后记录次数（失败/网络错误不计）
                    if !self.appState.subscriptionActive {
                        AppSettingsStore.shared.incrementFreeQueryCount()
                    }
                    if let cid = d.conversationId, !cid.isEmpty { self.currentConversationId = cid }

                    // 如果当前打开的是本地默认会话，则记录服务端 conversationId（用于后续合并加载）
                    if let cid = d.conversationId, !cid.isEmpty,
                       let localLoadedId = self.loadedHistoryId,
                       let localRecord = LocalDefaultQAStore.shared.defaultConversationRecord,
                       localRecord.localConversationId == localLoadedId {
                        LocalDefaultQAStore.shared.updateDefaultConversationServerId(cid)
                    }
                }
                self.historyRefreshTrigger += 1
            }
        }
    }

    public func reset() {
        inputText = ""
        pendingImage = nil
        turns = []
        state = .idle
        queryRiskState = .idle
        lastResult = nil
        lastQueryRisk = nil
        loadedHistoryId = nil
        currentConversationId = nil
    }

    /// 新建对话：清空当前内容并清空「正在查看的历史」，侧边栏会显示「新对话」占位
    public func startNewConversation() {
        reset()
    }

    /// 在首页打开一条历史记录：按会话拉取该对话下所有消息，渲染为多轮对话；并设置 currentConversationId 以便继续在该会话中提问。兼容旧数据（无 conversation_id 时按单条用 item 渲染）
    public func loadHistoryItem(_ item: QueryHistoryItem) {
        loadedHistoryId = item.id
        currentConversationId = item.id
        inputText = ""
        pendingImage = nil
        state = .loading
        Task {
            do {
                let messages = try await queryService.fetchHistoryByConversation(conversationId: item.id)
                let newTurns: [ChatTurn]
                if messages.isEmpty {
                    let singleText = item.content.trimmingCharacters(in: .whitespacesAndNewlines)
                    let result: ChatTurnResult = item.resultJson.map { .analysis(RiskAnalysisViewData(from: $0)) } ?? .failure("暂无结果")
                    let isScreenshot = item.inputType.lowercased() == QueryInputType.screenshot.rawValue
                    if isScreenshot {
                        // 截图类历史：优先显示图片，避免把 OCR/combined 大段文字当作“用户消息”展示
                        let imageKey = (item.imageUrl?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true)
                            ? (singleText.isEmpty ? nil : singleText)
                            : item.imageUrl
                        newTurns = [ChatTurn(userText: nil, userImage: nil, imageUrl: imageKey, status: .done(result))]
                    } else {
                        newTurns = [ChatTurn(userText: singleText.isEmpty ? nil : singleText, userImage: nil, imageUrl: item.imageUrl, status: .done(result))]
                    }
                } else {
                    newTurns = messages.map { row in
                        let userText = row.content.trimmingCharacters(in: .whitespacesAndNewlines)
                        let result: ChatTurnResult
                        if let json = row.resultJson {
                            result = .analysis(RiskAnalysisViewData(from: json))
                        } else {
                            result = .failure("暂无结果")
                        }
                        let isScreenshot = row.inputType.lowercased() == QueryInputType.screenshot.rawValue
                        if isScreenshot {
                            let contentKey = userText
                            let imageKey = (row.imageUrl?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true)
                                ? (contentKey.isEmpty ? nil : contentKey)
                                : row.imageUrl
                            return ChatTurn(userText: nil, userImage: nil, imageUrl: imageKey, status: .done(result))
                        } else {
                            return ChatTurn(userText: userText.isEmpty ? nil : userText, userImage: nil, imageUrl: row.imageUrl, status: .done(result))
                        }
                    }
                }
                await MainActor.run {
                    turns = newTurns
                    state = .idle
                    queryRiskState = .idle
                    lastResult = nil
                    lastQueryRisk = nil
                }
            } catch {
                await MainActor.run {
                    let singleText = item.content.trimmingCharacters(in: .whitespacesAndNewlines)
                    let result: ChatTurnResult = item.resultJson.map { .analysis(RiskAnalysisViewData(from: $0)) } ?? .failure("加载失败")
                    let isScreenshot = item.inputType.lowercased() == QueryInputType.screenshot.rawValue
                    if isScreenshot {
                        let imageKey = (item.imageUrl?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true)
                            ? (singleText.isEmpty ? nil : singleText)
                            : item.imageUrl
                        turns = [ChatTurn(userText: nil, userImage: nil, imageUrl: imageKey, status: .done(result))]
                    } else {
                        turns = [ChatTurn(userText: singleText.isEmpty ? nil : singleText, userImage: nil, imageUrl: item.imageUrl, status: .done(result))]
                    }
                    state = .idle
                    queryRiskState = .idle
                    lastResult = nil
                    lastQueryRisk = nil
                }
            }
        }
    }

    public func retry() {
        analyze()
    }

    /// 侧边栏「当前对话」展示文案：无消息时显示「当前对话 / Current chat」，有消息时为第一条用户内容或「上传图片 / Image analysis」
    public var currentConversationTitle: String {
        let isEnglish = AppSettingsStore.shared.languageCode == "en"
        let defaultTitle = isEnglish ? "Current chat" : "当前对话"
        if turns.isEmpty { return defaultTitle }
        guard let first = turns.first else { return defaultTitle }
        if let text = first.userText, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            let one = text
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .components(separatedBy: .newlines)
                .first ?? text
            let line = one.trimmingCharacters(in: .whitespacesAndNewlines)
            if line.count > 28 { return String(line.prefix(28)) + "…" }
            return line
        }
        return isEnglish ? "Image analysis" : "上传图片"
    }
}
