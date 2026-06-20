//
//  KnowledgeReportSheet.swift
//  IsItSafe
//
//  V4 案例库举报 sheet（与情报举报同语义）
//  App Store 1.2 UGC 合规：UGC 内容详情必须提供举报入口 + 24h 内处理违规
//

import SwiftUI

public struct KnowledgeReportSheet: View {
    public let knowledgeId: String
    /// 举报成功回调：上层（KnowledgeDetailView / KnowledgeView）从 list 移除本条 + dismiss
    public let onSubmitted: (() -> Void)?
    @Environment(\.dismiss) private var dismiss
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    @State private var selectedReason: ReportReason = .inaccurate
    @State private var note: String = ""
    @State private var submitting = false
    @State private var submitted = false
    @State private var errorMessage: String?

    public init(knowledgeId: String, onSubmitted: (() -> Void)? = nil) {
        self.knowledgeId = knowledgeId
        self.onSubmitted = onSubmitted
    }

    public enum ReportReason: String, CaseIterable, Identifiable {
        case spam, inaccurate, illegal, offensive, other
        public var id: String { rawValue }

        public func displayName(_ lang: String) -> String {
            let isEN = lang == "en"
            switch self {
            case .spam:       return isEN ? "Spam / Advertisement" : "垃圾 / 广告"
            case .inaccurate: return isEN ? "Inaccurate information" : "信息不准确"
            case .illegal:    return isEN ? "Illegal content" : "违法内容"
            case .offensive:  return isEN ? "Hateful or offensive" : "煽动或冒犯"
            case .other:      return isEN ? "Other" : "其他"
            }
        }
    }

    public var body: some View {
        NavigationStack {
            Form {
                Section(header: Text(languageCode == "en" ? "Reason" : "举报原因")) {
                    ForEach(ReportReason.allCases) { reason in
                        Button { selectedReason = reason } label: {
                            HStack {
                                Text(reason.displayName(languageCode))
                                    .foregroundColor(AppTheme.textPrimary)
                                Spacer()
                                if selectedReason == reason {
                                    Image(systemName: "checkmark")
                                        .foregroundColor(AppTheme.primary)
                                }
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
                Section(header: Text(languageCode == "en" ? "Note (optional)" : "补充说明（可选）"),
                        footer: Text(languageCode == "en"
                                     ? "Reports are reviewed within 24 hours. The case will be hidden from your view immediately."
                                     : "我们会在 24 小时内复核处理。提交后该案例对你立刻隐藏")) {
                    TextField(
                        languageCode == "en" ? "Up to 500 characters" : "最多 500 字",
                        text: $note,
                        axis: .vertical
                    )
                    .lineLimit(3...6)
                }
                if let err = errorMessage {
                    Section { Text(err).font(.caption).foregroundColor(AppTheme.riskHigh) }
                }
                Section {
                    Button { Task { await submit() } } label: {
                        HStack {
                            Spacer()
                            if submitting { ProgressView().tint(.white) }
                            Text(submitted
                                 ? (languageCode == "en" ? "Submitted ✓" : "已提交 ✓")
                                 : (languageCode == "en" ? "Submit Report" : "提交举报"))
                                .font(.body.weight(.semibold))
                                .foregroundColor(.white)
                            Spacer()
                        }
                        .padding(.vertical, 8)
                        .background(submitted ? AppTheme.riskMedium : AppTheme.primary)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                    .disabled(submitting || submitted)
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                }
            }
            .navigationTitle(languageCode == "en" ? "Report Case" : "举报案例")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(languageCode == "en" ? "Cancel" : "取消") { dismiss() }
                }
            }
        }
    }

    private func submit() async {
        submitting = true
        errorMessage = nil
        do {
            try await KnowledgeRepository.shared.report(
                id: knowledgeId,
                reason: selectedReason.rawValue,
                note: note.trimmingCharacters(in: .whitespacesAndNewlines)
            )
            submitted = true
            // 通知列表立刻 splice，再 dismiss → 收 sheet 时背景列表已少一条
            onSubmitted?()
            try? await Task.sleep(nanoseconds: 800_000_000)
            dismiss()
        } catch {
            errorMessage = (error as? APIError)?.userMessage ?? error.localizedDescription
        }
        submitting = false
    }
}
