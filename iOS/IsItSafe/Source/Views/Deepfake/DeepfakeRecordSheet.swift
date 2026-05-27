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
    @StateObject private var recorder = AudioRecorderService()

    @State private var phase: Phase = .ready
    @State private var submitting = false
    @State private var errorMessage: String?

    public init(onComplete: @escaping (DeepfakeCheck) -> Void) {
        self.onComplete = onComplete
    }

    public enum Phase {
        case ready, recording, processing
    }

    /// 实时 elapsed 直接走 recorder.elapsedSeconds
    private var elapsed: Int { recorder.elapsedSeconds }

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
                        recorder.cancel()
                        dismiss()
                    }
                }
            }
            // 录满 60 秒自动停止
            .onChange(of: recorder.elapsedSeconds) { _, sec in
                if phase == .recording && sec >= 60 {
                    stopAndSubmit()
                }
            }
        }
        .onDisappear { recorder.cancel() }
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
            if let err = errorMessage {
                Text(err).font(.caption).foregroundColor(AppTheme.riskHigh)
            }
            Spacer()
            Button {
                Task { await startRecord() }
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

    /// 开始录音（真实 AVAudioRecorder；权限拒绝时显示错误）
    private func startRecord() async {
        errorMessage = nil
        let ok = await recorder.start()
        if !ok {
            errorMessage = languageCode == "en"
                ? "Microphone permission denied"
                : "麦克风权限被拒绝。请在系统设置中开启"
            return
        }
        phase = .recording
        // 自动 60 秒停止：在 elapsed >= 60 时由 onChange 触发
    }

    private func stopAndSubmit() {
        guard let url = recorder.stop() else {
            phase = .ready
            errorMessage = languageCode == "en"
                ? "Recording failed"
                : "录音失败，请重试"
            return
        }
        let duration = elapsed
        phase = .processing
        submitting = true
        Task {
            do {
                // 1) 读取本地文件
                let audioData = try Data(contentsOf: url)
                // 2) 上传到 R2
                let fileUrl = try await NetworkManager.shared.uploadAudio(
                    type: "deepfake",
                    audioData: audioData,
                    mimeType: "audio/mp4",
                    filename: url.lastPathComponent
                )
                // 3) 调创建检测接口
                let check = try await DeepfakeRepository.shared.create(
                    sourceType: "record",
                    fileUrl: fileUrl,
                    fileDurationSec: duration
                )
                // 4) 清理本地临时文件
                try? FileManager.default.removeItem(at: url)
                submitting = false
                onComplete(check)
            } catch {
                submitting = false
                phase = .ready
                errorMessage = error.localizedDescription
                // 失败时也清理临时文件
                try? FileManager.default.removeItem(at: url)
            }
        }
    }

    private func waveHeight(at i: Int) -> CGFloat {
        // 用实时 meterDb 驱动波形（默认 -160 dB 时给个最小高度）
        let db = recorder.meterDb // -160 ~ 0 dB
        let normalized = max(0.05, CGFloat((db + 60) / 60))   // 映射到 0~1
        // 不同条形位置加相位偏移
        let phaseOffset = Double(i) * 0.5 + Double(elapsed)
        let wobble = abs(sin(phaseOffset))
        return max(8, 48 * normalized * (0.6 + 0.4 * CGFloat(wobble)))
    }

    private func formatTime(_ seconds: Int) -> String {
        let m = seconds / 60
        let s = seconds % 60
        return String(format: "%02d:%02d", m, s)
    }
}
