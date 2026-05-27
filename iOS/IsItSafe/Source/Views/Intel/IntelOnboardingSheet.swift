//
//  IntelOnboardingSheet.swift
//  IsItSafe
//
//  V3-B 新用户引导（B-P5）：注册成功后第一次进情报 Tab 时弹出
//  选关注类型 → 完成（一次性，UserDefaults 记录）
//

import SwiftUI

public struct IntelOnboardingSheet: View {
    @Environment(\.dismiss) private var dismiss
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    @AppStorage("isitsafe.intelOnboarded") private var onboarded: Bool = false

    @State private var categories: [IntelCategory] = []
    @State private var selected: Set<String> = []
    @State private var loading = true
    @State private var saving = false

    public init() {}

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    heroSection
                    if loading {
                        ProgressView().padding(40).frame(maxWidth: .infinity)
                    } else {
                        chipsSection
                    }
                }
                .padding(16)
            }
            .background(AppTheme.background.ignoresSafeArea())
            .navigationTitle(languageCode == "en" ? "Welcome" : "欢迎使用")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(languageCode == "en" ? "Skip" : "跳过") {
                        onboarded = true
                        dismiss()
                    }
                }
            }
            .task { await loadCategories() }
            .safeAreaInset(edge: .bottom) {
                doneButton
            }
        }
    }

    private var heroSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("🛡").font(.system(size: 48))
            Text(languageCode == "en" ? "Get tailored anti-scam intel" : "为你定制反诈情报")
                .font(.title3.weight(.bold))
            Text(languageCode == "en"
                 ? "Pick what you care about. We'll push timely warnings; you can change this anytime."
                 : "选你关心的，我们会推送及时预警；之后可随时修改")
                .font(.subheadline)
                .foregroundColor(AppTheme.textSecondary)
        }
    }

    private var chipsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(languageCode == "en"
                 ? "What worries you most?"
                 : "你最担心哪类骗局？（多选）")
                .font(.subheadline.weight(.semibold))
                .foregroundColor(AppTheme.textSecondary)
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                ForEach(categories) { cat in
                    chipCell(cat)
                }
            }
        }
    }

    private func chipCell(_ cat: IntelCategory) -> some View {
        Button {
            if selected.contains(cat.key) {
                selected.remove(cat.key)
            } else {
                selected.insert(cat.key)
            }
        } label: {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Image(systemName: selected.contains(cat.key) ? "checkmark.circle.fill" : "circle")
                        .foregroundColor(selected.contains(cat.key) ? AppTheme.primary : AppTheme.textSecondary)
                    Spacer()
                }
                Text(cat.name)
                    .font(.subheadline.weight(.medium))
                    .multilineTextAlignment(.leading)
                    .lineLimit(2)
                    .foregroundColor(AppTheme.textPrimary)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                selected.contains(cat.key)
                    ? AppTheme.primary.opacity(0.12)
                    : AppTheme.cardBackground
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(selected.contains(cat.key) ? AppTheme.primary : Color.clear, lineWidth: 1.5)
            )
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
    }

    private var doneButton: some View {
        VStack {
            Button {
                save()
            } label: {
                HStack {
                    if saving { ProgressView().tint(.white) }
                    Text(selected.isEmpty
                         ? (languageCode == "en" ? "Continue without picking" : "暂不选择，继续")
                         : (languageCode == "en"
                            ? "Save (\(selected.count) selected)"
                            : "保存（已选 \(selected.count) 项）"))
                        .font(.body.weight(.semibold))
                }
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(AppTheme.primary)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .disabled(saving)
        }
        .padding(16)
        .background(AppTheme.background)
    }

    private func loadCategories() async {
        loading = true
        do {
            categories = try await IntelRepository.shared.getCategories(language: languageCode)
        } catch {
            categories = []
        }
        loading = false
    }

    private func save() {
        saving = true
        Task {
            do {
                _ = try await IntelRepository.shared.updatePreferences(
                    IntelPreferencesUpdateRequest(
                        categories: Array(selected),
                        pushFreq: "daily_1",
                        pushTime: "09:00"
                    )
                )
            } catch {
                // 静默失败：onboarded 仍标记为已完成，用户可去 Preferences 修改
            }
            onboarded = true
            saving = false
            dismiss()
        }
    }
}
