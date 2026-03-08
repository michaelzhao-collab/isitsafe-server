//
//  SpeechRecognitionService.swift
//  IsItSafe
//
//  语音识别：按下开始录音，放手后 endAudio，识别完成后返回文字。
//

import AVFoundation
import Foundation
import Speech

public final class SpeechRecognitionService {
    public static let shared = SpeechRecognitionService()
    private let recognizer: SFSpeechRecognizer?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private let engine = AVAudioEngine()
    private var continuation: CheckedContinuation<String, Error>?

    private init() {
        recognizer = SFSpeechRecognizer(locale: Locale(identifier: "zh-CN"))
    }

    public func requestAuthorization() async -> Bool {
        await withCheckedContinuation { cont in
            SFSpeechRecognizer.requestAuthorization { status in
                cont.resume(returning: status == .authorized)
            }
        }
    }

    /// 按下时调用：开始录音，挂起直到放手后识别完成并返回文字
    public func startRecording() async throws -> String {
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<String, Error>) in
            guard let recognizer = recognizer, recognizer.isAvailable else {
                cont.resume(throwing: NSError(domain: "Speech", code: -1, userInfo: [NSLocalizedDescriptionKey: "语音识别不可用"]))
                return
            }
            engine.stop()
            request = SFSpeechAudioBufferRecognitionRequest()
            guard let request = request else {
                cont.resume(throwing: NSError(domain: "Speech", code: -1, userInfo: [NSLocalizedDescriptionKey: "创建请求失败"]))
                return
            }
            request.shouldReportPartialResults = false
            request.requiresOnDeviceRecognition = false
            continuation = cont

            let inputNode = engine.inputNode
            let format = inputNode.outputFormat(forBus: 0)
            engine.prepare()
            do {
                try engine.start()
            } catch {
                continuation = nil
                cont.resume(throwing: error)
                return
            }
            inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak request] buffer, _ in
                request?.append(buffer)
            }

            task = recognizer.recognitionTask(with: request) { [weak self] result, error in
                guard let self = self else { return }
                if let error = error {
                    self.finishRecording()
                    self.continuation?.resume(throwing: error)
                    self.continuation = nil
                    return
                }
                guard let result = result, result.isFinal else { return }
                let text = result.bestTranscription.formattedString
                self.finishRecording()
                self.continuation?.resume(returning: text)
                self.continuation = nil
            }
        }
    }

    /// 放手时调用：结束录音，startRecording 会在识别完成后返回
    public func stopRecording() {
        request?.endAudio()
    }

    private func finishRecording() {
        engine.stop()
        engine.inputNode.removeTap(onBus: 0)
        request = nil
        task?.cancel()
        task = nil
    }
}
