//
//  ReportView.swift
//  IsItSafe
//

import SwiftUI

public struct ReportView: View {
    @StateObject private var vm = ReportViewModel()
    @EnvironmentObject private var appState: AppStateViewModel
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"

    public init() {}

    public var body: some View {
        NavigationStack {
            Form {
                Section(languageCode == "en" ? "Report type" : "举报类型") {
                    ReportTypePicker(selection: $vm.selectedType)
                }
                Section(languageCode == "en" ? "Description" : "举报内容") {
                    TextField(languageCode == "en" ? "Describe in detail (≥ 5 chars)" : "请详细描述（至少5个字）", text: $vm.content, axis: .vertical)
                        .lineLimit(4...8)
                }
                Section {
                    PrimaryButton(title: languageCode == "en" ? "Submit" : "提交举报", isLoading: vm.isSubmitting) {
                        vm.submit()
                    }
                }
            }
            .navigationTitle(languageCode == "en" ? "Report" : "举报")
            .alert(languageCode == "en" ? "Submitted" : "提交成功", isPresented: $vm.submitSuccess) {
                Button(languageCode == "en" ? "OK" : "确定", role: .cancel) {}
            } message: {
                Text(languageCode == "en" ? "We will review your report shortly" : "我们会尽快处理您的举报")
            }
        }
    }
}
