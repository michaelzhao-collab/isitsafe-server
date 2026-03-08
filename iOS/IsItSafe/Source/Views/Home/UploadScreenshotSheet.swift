//
//  UploadScreenshotSheet.swift
//  IsItSafe
//

import SwiftUI

public struct UploadScreenshotSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Binding public var ocrText: String
    public var onAnalyze: (String) -> Void

    public var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                Text("请粘贴或输入截图中的文字，然后点击分析")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                TextEditor(text: $ocrText)
                    .padding(8)
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(.systemGray4), lineWidth: 1))
                    .frame(minHeight: 120)
                Button("分析") {
                    onAnalyze(ocrText.trimmingCharacters(in: .whitespacesAndNewlines))
                    dismiss()
                }
                .buttonStyle(.borderedProminent)
                .frame(maxWidth: .infinity)
            }
            .padding()
            .navigationTitle("截图分析")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") { dismiss() }
                }
            }
        }
    }
}
