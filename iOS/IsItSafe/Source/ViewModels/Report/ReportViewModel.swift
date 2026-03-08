//
//  ReportViewModel.swift
//  IsItSafe
//

import Combine
import Foundation
import SwiftUI

public final class ReportViewModel: ObservableObject {
    @Published public var selectedType: ReportType = .text
    @Published public var content = ""
    @Published public var relatedQueryId: String?
    @Published public var isSubmitting = false
    @Published public var submitSuccess = false

    private let reportService = ReportService.shared
    private let appState = AppStateViewModel.shared

    public var canSubmit: Bool {
        content.trimmingCharacters(in: .whitespacesAndNewlines).count >= 5
    }

    public func submit() {
        guard canSubmit else {
            appState.showError("请完善举报内容（至少5个字）")
            return
        }
        isSubmitting = true
        submitSuccess = false
        Task {
            do {
                _ = try await reportService.submit(type: selectedType, content: content.trimmingCharacters(in: .whitespacesAndNewlines), relatedQueryId: relatedQueryId)
                await MainActor.run {
                    isSubmitting = false
                    submitSuccess = true
                    content = ""
                }
            } catch {
                await MainActor.run {
                    isSubmitting = false
                    appState.showError((error as? APIError)?.userMessage ?? error.localizedDescription)
                }
            }
        }
    }
}
