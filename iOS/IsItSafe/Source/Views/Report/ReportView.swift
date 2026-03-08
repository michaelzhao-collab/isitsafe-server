//
//  ReportView.swift
//  IsItSafe
//

import SwiftUI

public struct ReportView: View {
    @StateObject private var vm = ReportViewModel()
    @EnvironmentObject private var appState: AppStateViewModel

    public init() {}

    public var body: some View {
        NavigationStack {
            Form {
                Section("举报类型") {
                    ReportTypePicker(selection: $vm.selectedType)
                }
                Section("举报内容") {
                    TextField("请详细描述（至少5个字）", text: $vm.content, axis: .vertical)
                        .lineLimit(4...8)
                }
                Section {
                    PrimaryButton(title: "提交举报", isLoading: vm.isSubmitting) {
                        vm.submit()
                    }
                }
            }
            .navigationTitle("举报")
            .alert("提交成功", isPresented: $vm.submitSuccess) {
                Button("确定", role: .cancel) {}
            } message: {
                Text("我们会尽快处理您的举报")
            }
        }
    }
}
