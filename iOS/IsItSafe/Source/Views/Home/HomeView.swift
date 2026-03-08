//
//  HomeView.swift
//  IsItSafe
//

import SwiftUI

public struct HomeView: View {
    @StateObject private var vm = HomeViewModel()
    @FocusState private var isInputFocused: Bool
    @State private var showScreenshotSheet = false
    @State private var screenshotOCRText = ""

    public init() {}

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    AnalyzeInputBar(
                        text: $vm.inputText,
                        pendingImage: vm.pendingImage,
                        onRemovePendingImage: { vm.clearPendingImage() },
                        onSubmit: { vm.analyze() },
                        onSendWithImage: { vm.analyzeImage($0) },
                        onCamera: { showScreenshotSheet = true },
                        onVoiceToggle: { },
                        onPlus: { showScreenshotSheet = true },
                        onVoiceHoldStart: nil,
                        onVoiceHoldEnd: nil,
                        isFocused: $isInputFocused
                    )
                    QuickActionGrid(
                        onPhone: { vm.inputText = "" },
                        onURL: { vm.inputText = "" },
                        onCompany: { vm.inputText = "" }
                    )
                    if vm.state.isLoading || vm.queryRiskState.isLoading {
                        LoadingOverlay()
                            .frame(height: 120)
                    }
                    if let data = vm.lastResult {
                        RiskResultCard(data: data)
                    }
                    if let res = vm.lastQueryRisk {
                        QueryRiskCard(response: res)
                    }
                    if case .failure(let e) = vm.state {
                        ErrorStateView(message: (e as? APIError)?.userMessage ?? e.localizedDescription, retry: { vm.retry() })
                    }
                    if case .failure(let e) = vm.queryRiskState {
                        ErrorStateView(message: (e as? APIError)?.userMessage ?? e.localizedDescription, retry: { vm.retry() })
                    }
                }
                .padding()
            }
            .navigationTitle("安全分析")
            .sheet(isPresented: $showScreenshotSheet) {
                UploadScreenshotSheet(ocrText: $screenshotOCRText) { text in
                    vm.analyzeScreenshot(ocrText: text)
                }
            }
        }
    }
}
