//
//  IntelPreferencesView.swift
//  IsItSafe
//
//  V3-B 情报偏好设置（B-P4）
//  - 关注类型多选（chips）
//  - 推送频次 picker
//  - 推送时间 picker
//

import SwiftUI

public struct IntelPreferencesView: View {
    @Environment(\.dismiss) private var dismiss
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"

    @State private var categories: [IntelCategory] = []
    @State private var selectedCategories: Set<String> = []
    @State private var pushFreq: String = "daily_1"
    @State private var pushTime: String = "09:00"
    @State private var loading = true
    @State private var saving = false

    public init() {}

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    hero
                    categorySection
                    frequencySection
                    timeSection
                    saveButton
                }
                .padding(16)
            }
            .background(AppTheme.background.ignoresSafeArea())
            .navigationTitle(languageCode == "en" ? "Intel Preferences" : "情报偏好")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(languageCode == "en" ? "Done" : "完成") { dismiss() }
                }
            }
            .task { await loadAll() }
        }
    }

    private var hero: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(languageCode == "en" ? "Tailor your intel feed" : "为你定制情报")
                .font(.title3.weight(.bold))
            Text(languageCode == "en"
                 ? "Pick what you care about. We'll push at the time you choose."
                 : "选择你最关心的，我们会在合适的时间推送")
                .font(.subheadline)
                .foregroundColor(AppTheme.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var categorySection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(languageCode == "en" ? "Topics" : "关注的话题")
                .font(.subheadline.weight(.semibold))
                .foregroundColor(AppTheme.textSecondary)
            if loading {
                ProgressView()
            } else {
                FlexibleChipsView(categories: categories, selected: $selectedCategories)
            }
        }
    }

    private var frequencySection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(languageCode == "en" ? "Push frequency" : "推送频次")
                .font(.subheadline.weight(.semibold))
                .foregroundColor(AppTheme.textSecondary)
            VStack(spacing: 0) {
                ForEach(freqOptions, id: \.0) { (key, label) in
                    Button { pushFreq = key } label: {
                        HStack {
                            Text(label).foregroundColor(AppTheme.textPrimary)
                            Spacer()
                            if pushFreq == key {
                                Image(systemName: "checkmark").foregroundColor(AppTheme.primary)
                            }
                        }
                        .padding(.vertical, 12)
                        .padding(.horizontal, 14)
                    }
                    if key != freqOptions.last?.0 {
                        Divider().padding(.leading, 14)
                    }
                }
            }
            .background(AppTheme.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
    }

    private var freqOptions: [(String, String)] {
        if languageCode == "en" {
            return [
                ("daily_1", "1 per day"),
                ("daily_3", "Up to 3 per day"),
                ("weekly", "Weekly digest"),
                ("off", "No push"),
            ]
        }
        return [
            ("daily_1", "每天 1 条（推荐）"),
            ("daily_3", "每天最多 3 条"),
            ("weekly", "每周汇总"),
            ("off", "不推送"),
        ]
    }

    private var timeSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(languageCode == "en" ? "Preferred push time" : "推送时间")
                .font(.subheadline.weight(.semibold))
                .foregroundColor(AppTheme.textSecondary)
            HStack {
                Text(languageCode == "en" ? "Send around" : "大约")
                Spacer()
                Picker("", selection: $pushTime) {
                    ForEach(timeOptions, id: \.self) { t in Text(t).tag(t) }
                }
                .pickerStyle(.menu)
            }
            .padding(.vertical, 12)
            .padding(.horizontal, 14)
            .background(AppTheme.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
    }

    private var timeOptions: [String] {
        ["08:00", "09:00", "12:00", "18:00", "20:00", "22:00"]
    }

    private var saveButton: some View {
        Button {
            save()
        } label: {
            HStack {
                if saving { ProgressView().tint(.white) }
                Text(languageCode == "en" ? "Save" : "保存")
                    .font(.body.weight(.semibold))
            }
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(AppTheme.primary)
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .disabled(saving)
        .padding(.top, 8)
    }

    private func loadAll() async {
        loading = true
        async let cats = (try? await IntelRepository.shared.getCategories(language: languageCode)) ?? []
        async let pref = try? await IntelRepository.shared.getPreferences()
        let (cs, p) = await (cats, pref)
        categories = cs
        if let p = p {
            selectedCategories = Set(p.categories)
            pushFreq = p.pushFreq
            pushTime = p.pushTime ?? "09:00"
        }
        loading = false
    }

    private func save() {
        saving = true
        Task {
            do {
                _ = try await IntelRepository.shared.updatePreferences(
                    IntelPreferencesUpdateRequest(
                        categories: Array(selectedCategories),
                        pushFreq: pushFreq,
                        pushTime: pushTime
                    )
                )
                saving = false
                dismiss()
            } catch {
                saving = false
            }
        }
    }
}

/// 自适应换行的 chip 选择器
private struct FlexibleChipsView: View {
    let categories: [IntelCategory]
    @Binding var selected: Set<String>

    var body: some View {
        // 简化：用 LazyVGrid 2 列布局，足够覆盖偏好选择需求
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)], spacing: 8) {
            ForEach(categories) { cat in
                Button {
                    if selected.contains(cat.key) {
                        selected.remove(cat.key)
                    } else {
                        selected.insert(cat.key)
                    }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: selected.contains(cat.key) ? "checkmark.circle.fill" : "circle")
                            .font(.system(size: 14))
                        Text(cat.name)
                            .font(.caption)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)
                        Spacer()
                    }
                    .padding(10)
                    .background(
                        selected.contains(cat.key)
                            ? AppTheme.primary.opacity(0.12)
                            : AppTheme.cardBackground
                    )
                    .foregroundColor(selected.contains(cat.key) ? AppTheme.primary : AppTheme.textPrimary)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }
            }
        }
    }
}
