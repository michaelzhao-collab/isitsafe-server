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

/// 录好但尚未上传的语音（2026-09-07 复核新增）。
/// 上传交给 ChatSyncEngine.sendVoice 做，失败时消息以"红点可重发"留在列表里，
/// 本地文件保留供重传——旧实现是上传失败直接删文件，老人的录音会静默消失。
public struct RecordedVoice {
    public let fileURL: URL
    public let duration: Int
    public let transcript: String
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

    /// 松手结束：停止录音 → 本地转文字 → 返回待上传的录音（**不上传**）。
    /// 时长过短（< 1s）返回 nil（当作误触，UI 提示"说话时间太短"）。
    ///
    /// 上传交由 `FamilyChatCoordinator.sendVoice` / `ChatSyncEngine.sendVoice` 完成，
    /// 这样上传失败时能留下一条可重发的消息，而不是把录音悄悄删掉。
    public func finishRecording() async -> RecordedVoice? {
        let duration = recorder.elapsedSeconds
        guard let fileURL = recorder.stop() else { return nil }
        guard duration >= 1 else {
            try? FileManager.default.removeItem(at: fileURL)
            return nil
        }
        // 本地转文字（失败/无授权/不支持离线则空串，不阻断发送）
        let transcript = await Self.transcribeFile(fileURL)
        return RecordedVoice(fileURL: fileURL, duration: duration, transcript: transcript)
    }

    /// 旧接口：录音 → 转文字 → 上传后返回结果。保留给尚未迁移的调用方。
    /// 与旧实现的区别：上传失败**不再删除本地文件**，录音至少还在磁盘上。
    /// 新代码请改用 `FamilyChatCoordinator.sendVoice(groupId:)`。
    public func finishAndCompose() async -> ComposedVoice? {
        guard let recorded = await finishRecording() else { return nil }
        do {
            let data = try Data(contentsOf: recorded.fileURL)
            let url = try await NetworkManager.shared.uploadAudio(
                type: "family_voice", audioData: data,
                mimeType: "audio/mp4", filename: "voice_\(UUID().uuidString).m4a"
            )
            try? FileManager.default.removeItem(at: recorded.fileURL)
            return ComposedVoice(url: url, duration: recorded.duration, transcript: recorded.transcript)
        } catch {
            return nil   // 保留文件：上层可提示失败，磁盘上的录音还在
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
        // 2026-09-07 复核：原来是 requiresOnDeviceRecognition = supportsOnDeviceRecognition，
        // 设备不支持离线模型时该值为 false → 录音被送到 Apple 云端识别，
        // 与隐私文案「转文字在设备本地完成、不出设备」不符。
        // 改为：不支持离线就直接放弃转文字（语音照发，只是没有文字稿）。
        guard recognizer.supportsOnDeviceRecognition else { return "" }
        let request = SFSpeechURLRecognitionRequest(url: url)
        request.requiresOnDeviceRecognition = true
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
