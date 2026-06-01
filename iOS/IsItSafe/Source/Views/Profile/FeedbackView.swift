//
//  FeedbackView.swift
//  IsItSafe
//
//  意见反馈：文案 + 可选一张图片，提交后 Toast「提交成功」。
//

import SwiftUI
import UIKit

public struct FeedbackView: View {
    @Environment(\.dismiss) private var dismiss
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    @State private var content: String = ""
    @State private var pickedImage: UIImage?
    @State private var showImagePicker = false
    @State private var submitting = false
    @State private var errorMessage: String?
    @FocusState private var contentFocused: Bool

    public init() {}

    public var body: some View {
        List {
            Section {
                TextField(languageCode == "en" ? "Enter your feedback or suggestions" : "请输入您的意见或建议", text: $content, axis: .vertical)
                    .lineLimit(5...10)
                    .focused($contentFocused)
            } header: {
                Text(languageCode == "en" ? "Feedback" : "反馈内容")
            }

            Section {
                Button {
                    showImagePicker = true
                } label: {
                    HStack {
                        Text(languageCode == "en" ? "Add image (optional, one only)" : "添加图片（选填，仅一张）")
                            .foregroundColor(AppTheme.primary)
                        Spacer()
                        if pickedImage != nil {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(.green)
                        }
                    }
                }
                if let img = pickedImage {
                    Image(uiImage: img)
                        .resizable()
                        .scaledToFit()
                        .frame(maxHeight: 200)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                    Button("移除图片", role: .destructive) {
                        pickedImage = nil
                    }
                }
            }

            Section {
                Button {
                    submitFeedback()
                } label: {
                    HStack {
                        Spacer()
                        if submitting {
                            ProgressView()
                                .tint(.white)
                        } else {
                            Text(languageCode == "en" ? "Submit" : "提交")
                                .fontWeight(.medium)
                        }
                        Spacer()
                    }
                    .padding(.vertical, 12)
                    .frame(maxWidth: .infinity)
                    .background(
                        submitting || content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                            ? Color(UIColor.tertiarySystemFill)
                            : AppTheme.primary
                    )
                    .foregroundColor(
                        submitting || content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                            ? Color(UIColor.placeholderText)
                            : .white
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                .buttonStyle(.plain)
                .disabled(submitting || content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets(top: 16, leading: 16, bottom: 0, trailing: 16))
            }
        }
        .listStyle(.insetGrouped)
        .background(AppTheme.background)
        .scrollDismissesKeyboard(.interactively)   // 下拉/滚动可隐藏键盘
        .toolbar {
            // 键盘上方加"完成"按钮主动收键盘
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button(languageCode == "en" ? "Done" : "完成") {
                    contentFocused = false
                }
            }
        }
        .navigationTitle(languageCode == "en" ? "Feedback" : "意见反馈")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showImagePicker) {
            PhotoLibraryPicker { data in
                guard let data = data, let img = UIImage(data: data) else { return }
                pickedImage = img
                showImagePicker = false
            }
        }
        .alert(languageCode == "en" ? "Notice" : "提示", isPresented: .init(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
            Button(languageCode == "en" ? "OK" : "确定", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private func submitFeedback() {
        let text = content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        submitting = true
        Task {
            do {
                var imageUrl: String?
                if let img = pickedImage, let data = img.jpegData(compressionQuality: 0.8) {
                    // 之前用 try? 会吞掉 R2 上传错误，导致用户看不到为什么 admin 收不到图。
                    // 改成 try：上传失败 → catch 弹错误（"R2 服务连接失败" 等）让业主能定位
                    imageUrl = try await NetworkManager.shared.uploadFile(
                        type: "screenshot",
                        imageData: data,
                        mimeType: "image/jpeg",
                        filename: "feedback-\(Int(Date().timeIntervalSince1970)).jpg"
                    )
                }
                try await FeedbackService.shared.submit(content: text, imageUrl: imageUrl)
                await MainActor.run {
                    submitting = false
                    AppStateViewModel.shared.showSuccess(languageCode == "en" ? "Submitted" : "提交成功")
                    dismiss()
                }
            } catch {
                await MainActor.run {
                    submitting = false
                    errorMessage = (error as? APIError)?.userMessage ?? error.localizedDescription
                }
            }
        }
    }
}
