//
//  CountryPickerSheet.swift
//  IsItSafe
//

import SwiftUI

struct CountryPickerSheet: View {
    @Binding var selected: PhoneCountry
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""

    var body: some View {
        NavigationStack {
            List(filtered, id: \.id) { country in
                Button {
                    selected = country
                    dismiss()
                } label: {
                    HStack(spacing: 12) {
                        Text(countryDisplayName(country))
                            .foregroundColor(AppTheme.textPrimary)
                        Spacer()
                        if country.id == selected.id {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(AppTheme.primaryTint)
                        }
                    }
                }
            }
            .searchable(text: $query, prompt: isChineseSystem ? "国家或地区" : "Country / Region")
            .navigationTitle(isChineseSystem ? "国家或地区" : "Country / Region")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(isChineseSystem ? "完成" : "Done") { dismiss() }
                }
            }
        }
    }

    private var filtered: [PhoneCountry] {
        PhoneCountry.search(query)
    }

    /// 跟 App 内语言走（原来按系统语言，App 设成英文时国家名仍是中文）
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    private var isChineseSystem: Bool { languageCode != "en" }

    private func countryDisplayName(_ country: PhoneCountry) -> String {
        let name = isChineseSystem ? country.nameZh : country.nameEn
        return "\(name)(\(country.dialCode))"
    }
}
