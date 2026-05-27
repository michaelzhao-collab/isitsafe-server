//
//  IntelSubmitSheet.swift
//  IsItSafe
//
//  V3-B 用户上报情报（B-P3）
//  上报后进入 admin pending 队列，审核合并到 IntelAlert
//

import SwiftUI

public struct IntelSubmitSheet: View {
    @Environment(\.dismiss) private var dismiss
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"

    @State private var content: String = ""
    @State private var selectedCategory: String = "phishing"
    @State private var categories: [IntelCategory] = []
    @State private var submitting = false
    @State private var success = false

    public init() {}

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    hero
                    categoryPicker
                    contentField
                    warningCard
                    submitButton
                }
                .padding(16)
            }
            .background(AppTheme.background.ignoresSafeArea())
            .navigationTitle(languageCode == "en" ? "Report a scam" : "我也遇到过")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(languageCode == "en" ? "Cancel" : "取消") { dismiss() }
                }
            }
            .task { await loadCategories() }
            .alert(languageCode == "en" ? "Submitted" : "已提交",
                   isPresented: $success) {
                Button(languageCode == "en" ? "OK" : "好") { dismiss() }
            } message: {
                Text(languageCode == "en"
                     ? "Thanks! Our editors will review and may publish it (de-identified)."
                     : "感谢您！我们会审核后脱敏发布到情报库。")
            }
        }
    }

    private var hero: some View {
        HStack(spacing: 10) {
            Text("📢").font(.title)
            VStack(alignment: .leading, spacing: 2) {
                Text(languageCode == "en" ? "Help others avoid the same trap" : "帮其他人避开同样的坑")
                    .font(.subheadline.weight(.semibold))
                Text(languageCode == "en"
                     ? "We'll review and de-identify before publishing."
                     : "我们审核后脱敏发布，不会显示你的身份")
                    .font(.caption)
                    .foregroundColor(AppTheme.textSecondary)
            }
        }
        .padding(12)
        .background(AppTheme.premiumWhyCard.opacity(0.4))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private var categoryPicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(languageCode == "en" ? "Category" : "骗局类型")
                .font(.subheadline.weight(.semibold))
                .foregroundColor(AppTheme.textSecondary)
            if categories.isEmpty {
                ProgressView()
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(categories) { cat in
                            Button { selectedCategory = cat.key } label: {
                                Text(cat.name)
                                    .font(.caption)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 8)
                                    .background(
                                        selectedCategory == cat.key
                                            ? AppTheme.primary.opacity(0.15)
                                            : Color(.systemGray6)
                                    )
                                    .foregroundColor(selectedCategory == cat.key ? AppTheme.primary : AppTheme.textPrimary)
                                    .clipShape(Capsule())
                            }
                        }
                    }
                }
            }
        }
    }

    private var contentField: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(languageCode == "en" ? "Describe what happened" : "详细描述（怎么遇到的）")
                .font(.subheadline.weight(.semibold))
                .foregroundColor(AppTheme.textSecondary)
            TextEditor(text: $content)
                .frame(minHeight: 160)
                .padding(8)
                .background(AppTheme.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(alignment: .topLeading) {
                    if content.isEmpty {
                        Text(languageCode == "en"
                             ? "e.g. They called pretending to be customs and asked me to..."
                             : "例如：自称海关说我的包裹涉嫌违禁要求加微信…")
                            .foregroundColor(AppTheme.textSecondary.opacity(0.7))
                            .padding(14)
                            .allowsHitTesting(false)
                    }
                }
            Text("\(content.count) / 2000")
                .font(.caption2)
                .foregroundColor(AppTheme.textSecondary)
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
    }

    private var warningCard: some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "info.circle")
                .foregroundColor(AppTheme.primary)
            Text(languageCode == "en"
                 ? "Don't include personal info. Editors will de-identify before publishing."
                 : "请不要透露任何个人信息（手机号、身份证号）。我们会再次脱敏。")
                .font(.caption)
                .foregroundColor(AppTheme.textSecondary)
        }
        .padding(10)
        .background(AppTheme.primary.opacity(0.06))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private var submitButton: some View {
        Button {
            submit()
        } label: {
            HStack {
                if submitting { ProgressView().tint(.white) }
                Text(languageCode == "en" ? "Submit" : "提交")
                    .font(.body.weight(.semibold))
            }
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(content.count >= 20 ? AppTheme.primary : AppTheme.primary.opacity(0.4))
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .disabled(submitting || content.count < 20)
        .padding(.top, 8)
    }

    private func loadCategories() async {
        do {
            categories = try await IntelRepository.shared.getCategories(language: languageCode)
        } catch {
            // fallback: 用本地固定列表
            categories = [
                IntelCategory(key: "impersonation", name: "冒充客服 / 公检法"),
                IntelCategory(key: "phishing", name: "钓鱼链接 / 假 App"),
                IntelCategory(key: "investment", name: "投资理财"),
                IntelCategory(key: "package", name: "快递物流"),
                IntelCategory(key: "job", name: "兼职刷单"),
                IntelCategory(key: "romance", name: "杀猪盘"),
            ]
        }
    }

    private func submit() {
        submitting = true
        Task {
            do {
                _ = try await IntelRepository.shared.submit(
                    IntelSubmitRequest(category: selectedCategory, content: content, attachments: nil)
                )
                success = true
            } catch {
                // 简单提示
                content = "" // 不清空内容，留给用户重试
            }
            submitting = false
        }
    }
}
