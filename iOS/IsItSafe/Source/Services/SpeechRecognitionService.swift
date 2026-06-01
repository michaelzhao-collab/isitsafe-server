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
    /// 累积 partial transcription，用于系统返 No speech detected 时兜底
    private var lastPartialText: String = ""

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
            // 关键：先配置 AVAudioSession，否则 inputNode 拿不到有效采样率
            // 导致 AVAudioEngine.start() 报 -10851 (kAudioUnitErr_InvalidPropertyValue)
            // mode 改 .spokenAudio（之前 .measurement 关闭了 silence detection
            // + echo cancellation，导致长辈说话慢 / 通话场景识别率差）
            do {
                let session = AVAudioSession.sharedInstance()
                try session.setCategory(
                    .playAndRecord,
                    mode: .spokenAudio,
                    options: [.duckOthers, .defaultToSpeaker, .allowBluetooth]
                )
                try session.setActive(true, options: .notifyOthersOnDeactivation)
            } catch {
                cont.resume(throwing: error)
                return
            }
            engine.stop()
            request = SFSpeechAudioBufferRecognitionRequest()
            guard let request = request else {
                cont.resume(throwing: NSError(domain: "Speech", code: -1, userInfo: [NSLocalizedDescriptionKey: "创建请求失败"]))
                return
            }
            // 启用 partial：长辈说话慢、中间停顿可能让系统 finalize 时报 No speech，
            // 我们手动收 partial 兜底
            request.shouldReportPartialResults = true
            request.requiresOnDeviceRecognition = false
            request.taskHint = .dictation
            // 长辈反诈高频词加 contextualStrings 提升识别率（仅 zh-CN）
            request.contextualStrings = [
                "派出所", "公安局", "银行卡", "安全账户", "验证码",
                "微信", "支付宝", "转账", "短信", "链接",
                "客服", "中奖", "退款", "包裹", "快递",
                "贷款", "理财", "投资", "诈骗", "可疑"
            ]
            lastPartialText = ""
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
                // 收集 partial：用户说一半被系统 finalize 时也能拿到部分文本
                if let result = result {
                    let text = result.bestTranscription.formattedString
                    if !text.isEmpty {
                        self.lastPartialText = text
                    }
                    if result.isFinal {
                        self.finishRecording()
                        self.continuation?.resume(returning: text)
                        self.continuation = nil
                        return
                    }
                }
                if let error = error as NSError? {
                    // "No speech detected" (1110/203) → 如果已经有 partial，返回
                    //   partial；否则才真的报错
                    // 修业主反馈：长辈点了说一下后一直提示 No speech detected
                    let isNoSpeech = error.code == 1110
                        || error.code == 203
                        || error.localizedDescription.lowercased().contains("no speech")
                    self.finishRecording()
                    if isNoSpeech, !self.lastPartialText.isEmpty {
                        self.continuation?.resume(returning: self.lastPartialText)
                    } else if isNoSpeech {
                        // 友好提示替代英文系统错误
                        self.continuation?.resume(throwing: NSError(
                            domain: "Speech",
                            code: 1110,
                            userInfo: [NSLocalizedDescriptionKey: "没听清楚您说的话，请再试一次"]
                        ))
                    } else {
                        self.continuation?.resume(throwing: error)
                    }
                    self.continuation = nil
                }
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
        // 释放 AudioSession，避免长时间占麦克风影响 TTS / 通话 / 其它录音
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}
