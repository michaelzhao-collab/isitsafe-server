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
    /// 分析完成后递增，用于触发历史列表刷新（新对话记录已落库）
    @Published public var historyRefreshTrigger: Int = 0

    @Published public var state: LoadableState<RiskAnalysisViewData> = .idle
    @Published public var queryRiskState: LoadableState<QueryRiskResponse> = .idle
    @Published public var lastResult: RiskAnalysisViewData?
    @Published public var lastQueryRisk: QueryRiskResponse?

    private let aiService = AIService.shared
    private let queryService = QueryService.shared
    private let appState = AppStateViewModel.shared

    public init() {}

    public func analyze() {
        let content = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !content.isEmpty else { return }
        appendTurn(userText: content, userImage: nil)
        inputText = ""
        runAnalysisForLastTurn(content: content, isScreenshot: false)
    }

    public func clearPendingImage() {
        pendingImage = nil
    }

    public func analyzeImage(_ image: UIImage) {
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
        appendTurn(userText: ocrText, userImage: nil)
        runAnalysisForLastTurn(content: ocrText, isScreenshot: true)
    }

    private func appendTurn(userText: String?, userImage: UIImage?) {
        turns.append(ChatTurn(userText: userText, userImage: userImage, status: .analyzing))
    }

    private func updateLastTurn(_ result: ChatTurnResult) {
        guard let idx = turns.indices.last else { return }
        let t = turns[idx]
        turns[idx] = ChatTurn(id: t.id, userText: t.userText, userImage: t.userImage, status: .done(result))
    }

    private func runAnalysisForLastTurn(content: String, isScreenshot: Bool) {
        let index = turns.count - 1
        let start = Date()
        let classification = InputClassifier.classify(content, isScreenshot: isScreenshot)
        Task {
            let result: ChatTurnResult
            switch classification {
            case .aiText, .aiScreenshot:
                do {
                    var imageUrl: String?
                    if isScreenshot {
                        let img = await MainActor.run { self.turns.indices.contains(index) ? self.turns[index].userImage : nil }
                        if let image = img, let data = image.jpegData(compressionQuality: 0.8) {
                            imageUrl = await UploadService.shared.uploadScreenshot(data, mimeType: "image/jpeg")
                        }
                    }
                    let viewData: RiskAnalysisViewData
                    if isScreenshot {
                        viewData = try await aiService.analyzeScreenshot(content: content, language: "zh", imageUrl: imageUrl)
                    } else {
                        viewData = try await aiService.analyzeText(content: content, language: "zh", country: nil)
                    }
                    result = .analysis(viewData)
                } catch {
                    result = .failure((error as? APIError)?.userMessage ?? error.localizedDescription)
                }
            case .queryPhone:
                do {
                    let res = try await queryService.queryPhone(content)
                    result = .query(res)
                } catch {
                    result = .failure((error as? APIError)?.userMessage ?? error.localizedDescription)
                }
            case .queryURL:
                do {
                    let res = try await queryService.queryURL(content)
                    result = .query(res)
                } catch {
                    result = .failure((error as? APIError)?.userMessage ?? error.localizedDescription)
                }
            case .queryCompany:
                do {
                    let res = try await queryService.queryCompany(content)
                    result = .query(res)
                } catch {
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
                    self.turns[index] = ChatTurn(id: t.id, userText: t.userText, userImage: t.userImage, status: .done(result))
                    self.scrollToTurnId = t.id
                }
                if case .analysis(let d) = result { self.lastResult = d; self.state = .success(d) }
                else if case .query(let r) = result { self.lastQueryRisk = r; self.queryRiskState = .success(r) }
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
    }

    /// 新建对话：清空当前内容并清空「正在查看的历史」，侧边栏会显示「新对话」占位
    public func startNewConversation() {
        reset()
    }

    /// 在首页打开一条历史记录：用该条的用户输入 + 结果渲染为一轮对话
    public func loadHistoryItem(_ item: QueryHistoryItem) {
        loadedHistoryId = item.id
        inputText = ""
        pendingImage = nil
        let userText = item.content.trimmingCharacters(in: .whitespacesAndNewlines)
        let result: ChatTurnResult
        if let json = item.resultJson {
            result = .analysis(RiskAnalysisViewData(from: json))
        } else {
            result = .failure("暂无结果")
        }
        let turn = ChatTurn(userText: userText.isEmpty ? nil : userText, userImage: nil, status: .done(result))
        turns = [turn]
        state = .idle
        queryRiskState = .idle
        lastResult = nil
        lastQueryRisk = nil
    }

    public func retry() {
        analyze()
    }
}
