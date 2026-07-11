//
//  VoiceMessageComposer.swift
//  IsItSafe
//
//  V5.1 家庭 IM 语音消息编排：录音 → 本地转文字 → 上传 R2 → 组装 payload。
//
//  复用既有 AudioRecorderService（录 m4a）；转文字用 SFSpeechURLRecognitionRequest
//  对录好的文件做**本地**识别（离线、免费、不出设备），与直播识别互不干扰。
//

import Foundation
import Speech

/// 语音消息组装结果，供 ChatMessage payload 使用
public struct ComposedVoice {
    public let url: String        // R2 地址
    public let duration: Int      // 秒
    public let transcript: String // 本地转文字（可能为空）
}

@MainActor
public final class VoiceMessageComposer {
    public static let shared = VoiceMessageComposer()

    private let recorder = AudioRecorderService()
    private init() {}

    /// 录音进度（供 UI 波形/计时）
    public var isRecording: Bool { recorder.isRecording }
    public var elapsedSeconds: Int { recorder.elapsedSeconds }
    public var recorderService: AudioRecorderService { recorder }

    /// 开始录音；返回是否成功（失败多为无麦克风权限）
    public func startRecording() async -> Bool {
        await recorder.start()
    }

    /// 取消（上滑取消）
    public func cancelRecording() {
        recorder.cancel()
    }

    /// 松手结束：停止录音 → 转文字 → 上传 → 返回结果。
    /// 时长过短（< 1s）返回 nil（当作误触，UI 提示"说话时间太短"）。
    public func finishAndCompose() async -> ComposedVoice? {
        let duration = recorder.elapsedSeconds
        guard let fileURL = recorder.stop() else { return nil }
        guard duration >= 1 else {
            try? FileManager.default.removeItem(at: fileURL)
            return nil
        }

        // 1) 本地转文字（失败/无授权则空串，不阻断发送）
        let transcript = await Self.transcribeFile(fileURL)

        // 2) 上传 R2
        do {
            let data = try Data(contentsOf: fileURL)
            let url = try await NetworkManager.shared.uploadAudio(
                type: "family_voice", audioData: data,
                mimeType: "audio/mp4", filename: "voice_\(UUID().uuidString).m4a"
            )
            try? FileManager.default.removeItem(at: fileURL)
            return ComposedVoice(url: url, duration: duration, transcript: transcript)
        } catch {
            try? FileManager.default.removeItem(at: fileURL)
            return nil
        }
    }

    /// 对已录制文件做本地语音识别（on-device，隐私不出设备）
    static func transcribeFile(_ url: URL) async -> String {
        let authed = await withCheckedContinuation { (cont: CheckedContinuation<Bool, Never>) in
            SFSpeechRecognizer.requestAuthorization { cont.resume(returning: $0 == .authorized) }
        }
        guard authed else { return "" }
        let lang = UserDefaults.standard.string(forKey: "isitsafe.language") == "en" ? "en-US" : "zh-CN"
        guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: lang)), recognizer.isAvailable else {
            return ""
        }
        let request = SFSpeechURLRecognitionRequest(url: url)
        request.requiresOnDeviceRecognition = recognizer.supportsOnDeviceRecognition
        request.shouldReportPartialResults = false

        return await withCheckedContinuation { (cont: CheckedContinuation<String, Never>) in
            var resumed = false
            recognizer.recognitionTask(with: request) { result, error in
                if let result, result.isFinal {
                    if !resumed { resumed = true; cont.resume(returning: result.bestTranscription.formattedString) }
                } else if error != nil {
                    if !resumed { resumed = true; cont.resume(returning: "") }
                }
            }
        }
    }
}

/// 家庭 IM 语音消息 payload 组装辅助
public enum ChatVoicePayload {
    public static func make(_ v: ComposedVoice) -> [String: JSONValue] {
        [
            "url": .string(v.url),
            "duration": .number(Double(v.duration)),
            "transcript": .string(v.transcript),
        ]
    }
}
