//
//  DeepfakeRecordSheet.swift
//  IsItSafe
//
//  V3-A1 录音/上传 sheet（一期 stub：模拟波形 + 倒计时 + 上传）
//  二期：接入 AVAudioRecorder 真实录音 + R2 上传
//

import SwiftUI

public struct DeepfakeRecordSheet: View {
    public let onComplete: (DeepfakeCheck) -> Void
    @Environment(\.dismiss) private var dismiss
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"

    @State private var phase: Phase = .ready
    @State private var elapsed: Int = 0
    @State private var timer: Timer?
    @State private var submitting = false

    public init(onComplete: @escaping (DeepfakeCheck) -> Void) {
        self.onComplete = onComplete
    }

    public enum Phase {
        case ready, recording, processing
    }

    public var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                switch phase {
                case .ready: readyView
                case .recording: recordingView
                case .processing: processingView
                }
            }
            .padding(20)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(AppTheme.background.ignoresSafeArea())
            .navigationTitle(languageCode == "en" ? "Voice Deepfake Check" : "语音深伪检测")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(languageCode == "en" ? "Cancel" : "取消") {
                        stopTimer()
                        dismiss()
                    }
                }
            }
        }
        .onDisappear { stopTimer() }
    }

    // MARK: - Ready
    private var readyView: some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "mic.fill")
                .font(.system(size: 56))
                .foregroundColor(AppTheme.primary)
                .padding(28)
                .background(AppTheme.primary.opacity(0.1))
                .clipShape(Circle())
            Text(languageCode == "en" ? "Ready to record" : "准备录音")
                .font(.title3.weight(.bold))
            Text(languageCode == "en"
                 ? "Record 10–60s of the suspicious voice"
                 : "录制 10–60 秒可疑语音")
                .font(.subheadline)
                .foregroundColor(AppTheme.textSecondary)
                .multilineTextAlignment(.center)
            Spacer()
            Button {
                startRecord()
            } label: {
                Text(languageCode == "en" ? "Start Recording" : "开始录音")
                    .font(.body.weight(.semibold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(AppTheme.riskHigh)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
            }
        }
    }

    // MARK: - Recording
    private var recordingView: some View {
        VStack(spacing: 18) {
            Spacer()
            // 波形动画（占位）
            HStack(spacing: 4) {
                ForEach(0..<20) { i in
                    Capsule()
                        .fill(AppTheme.primary)
                        .frame(width: 4, height: waveHeight(at: i))
                        .animation(.easeInOut(duration: 0.3).repeatForever().delay(Double(i) * 0.05), value: elapsed)
                }
            }
            .frame(height: 64)

            Text(formatTime(elapsed))
                .font(.system(size: 48, weight: .heavy, design: .monospaced))
                .foregroundColor(AppTheme.primary)

            Text(languageCode == "en" ? "Recording... (10–60s)" : "正在录制（10–60 秒）")
                .font(.subheadline)
                .foregroundColor(AppTheme.textSecondary)

            Spacer()

            Button {
                stopAndSubmit()
            } label: {
                HStack {
                    Image(systemName: "stop.fill")
                    Text(languageCode == "en" ? "Stop & Analyze" : "停止并分析")
                }
                .font(.body.weight(.semibold))
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(elapsed >= 10 ? AppTheme.primary : AppTheme.primary.opacity(0.5))
                .clipShape(RoundedRectangle(cornerRadius: 14))
            }
            .disabled(elapsed < 10)
        }
    }

    // MARK: - Processing
    private var processingView: some View {
        VStack(spacing: 20) {
            Spacer()
            ProgressView()
                .scaleEffect(1.6)
                .padding(.bottom, 8)
            Text(languageCode == "en" ? "AI analyzing..." : "AI 正在分析声音特征")
                .font(.subheadline.weight(.semibold))
            VStack(spacing: 8) {
                phaseLine(emoji: "🎚", label: languageCode == "en" ? "Audio preprocess" : "音频预处理", done: true)
                phaseLine(emoji: "📈", label: languageCode == "en" ? "Spectrum analysis" : "频谱分析", done: true)
                phaseLine(emoji: "🧠", label: languageCode == "en" ? "AI synthesis detection" : "AI 合成检测", done: false)
            }
            .padding(.horizontal, 24)
            Spacer()
        }
    }

    private func phaseLine(emoji: String, label: String, done: Bool) -> some View {
        HStack {
            Text(emoji)
            Text(label).font(.caption)
            Spacer()
            Text(done ? "✓" : "...")
                .font(.caption.weight(.bold))
                .foregroundColor(done ? AppTheme.riskLow : AppTheme.primary)
        }
        .padding(.vertical, 4)
    }

    // MARK: - 流程

    private func startRecord() {
        phase = .recording
        elapsed = 0
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { _ in
            DispatchQueue.main.async {
                elapsed += 1
                if elapsed >= 60 {
                    stopAndSubmit()
                }
            }
        }
    }

    private func stopAndSubmit() {
        stopTimer()
        phase = .processing
        submitting = true
        Task {
            // 一期 stub：直接调 createCheck，传 mock file URL
            // 二期：真实录音文件先上传 R2 → 拿 url → createCheck
            let mockUrl = "https://r2.starlens.ai/deepfake-stub/\(UUID().uuidString).m4a"
            do {
                let check = try await DeepfakeRepository.shared.create(
                    sourceType: "record",
                    fileUrl: mockUrl,
                    fileDurationSec: elapsed
                )
                submitting = false
                onComplete(check)
            } catch {
                submitting = false
                phase = .ready
            }
        }
    }

    private func stopTimer() {
        timer?.invalidate()
        timer = nil
    }

    private func waveHeight(at i: Int) -> CGFloat {
        let phaseOffset = Double(i) * 0.4 + Double(elapsed)
        let v = sin(phaseOffset) * 24 + 32
        return max(8, CGFloat(v))
    }

    private func formatTime(_ seconds: Int) -> String {
        let m = seconds / 60
        let s = seconds % 60
        return String(format: "%02d:%02d", m, s)
    }
}
