//
//  TTSService.swift
//  IsItSafe
//
//  V3-J 长辈模式：文本转语音朗读
//
//  一期：纯 AVSpeechSynthesizer 系统 TTS（中文女声 com.apple.ttsbundle.Tingting-compact）
//  二期：可切换火山引擎 / iFLYTEK 更自然的女声（按 user.language 路由）
//

import Foundation
import AVFoundation
import Combine

@MainActor
public final class TTSService: NSObject, ObservableObject {
    public static let shared = TTSService()

    /// 当前是否正在朗读
    @Published public private(set) var isSpeaking = false
    /// 当前是否暂停中
    @Published public private(set) var isPaused = false
    /// 当前进度（0.0 - 1.0）
    @Published public private(set) var progress: Double = 0

    private let synthesizer = AVSpeechSynthesizer()
    private var currentText: String = ""

    /// 文本是否含中日韩字符（用于在没显式指定语言时选音色）
    static func containsCJK(_ text: String) -> Bool {
        text.unicodeScalars.contains { s in
            (0x4E00...0x9FFF).contains(s.value)     // CJK 统一表意文字
                || (0x3400...0x4DBF).contains(s.value)  // 扩展 A
                || (0x3040...0x30FF).contains(s.value)  // 日文假名
                || (0xAC00...0xD7AF).contains(s.value)  // 韩文
        }
    }

    override init() {
        super.init()
        synthesizer.delegate = self
    }

    /// 朗读文本
    /// - Parameter language: 'zh' / 'en'（如果不传按系统语言）
    public func speak(_ text: String, language: String? = nil) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        // 已在朗读 → 先停掉
        if synthesizer.isSpeaking {
            synthesizer.stopSpeaking(at: .immediate)
        }

        currentText = trimmed
        progress = 0
        isPaused = false

        let utterance = AVSpeechUtterance(string: trimmed)
        let langCode: String = {
            if let l = language {
                return l == "zh" ? "zh-CN" : "en-US"
            }
            // 2026-09-07 复核：原来 language 为 nil 时按【设备系统语言】选音色，
            // 系统语言设成英文的华人老人会用 en-US 音色读中文，基本读不出来。
            // 改为：优先看正文里有没有中日韩字符，其次才看 App 内语言设置。
            if Self.containsCJK(trimmed) { return "zh-CN" }
            let appLang = UserDefaults.standard.string(forKey: "isitsafe.language")
            if let appLang { return appLang == "en" ? "en-US" : "zh-CN" }
            let pref = Locale.preferredLanguages.first?.lowercased() ?? "zh"
            return pref.hasPrefix("zh") ? "zh-CN" : "en-US"
        }()
        utterance.voice = AVSpeechSynthesisVoice(language: langCode)
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate * 0.92  // 老年人偏慢
        utterance.pitchMultiplier = 1.0
        utterance.volume = 1.0
        utterance.preUtteranceDelay = 0.1

        // 避免被静音键/其他媒体影响
        configureAudioSession()
        synthesizer.speak(utterance)
    }

    /// 暂停 / 恢复
    public func togglePause() {
        if isPaused {
            synthesizer.continueSpeaking()
            isPaused = false
        } else if isSpeaking {
            synthesizer.pauseSpeaking(at: .word)
            isPaused = true
        }
    }

    /// 完全停止
    public func stop() {
        if synthesizer.isSpeaking || synthesizer.isPaused {
            synthesizer.stopSpeaking(at: .immediate)
        }
        isSpeaking = false
        isPaused = false
        progress = 0
    }

    private func configureAudioSession() {
        #if os(iOS)
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            #if DEBUG
            print("[TTS] audio session error: \(error)")
            #endif
        }
        #endif
    }
}

extension TTSService: AVSpeechSynthesizerDelegate {
    public nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didStart utterance: AVSpeechUtterance) {
        Task { @MainActor in self.isSpeaking = true }
    }

    public nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        Task { @MainActor in
            self.isSpeaking = false
            self.isPaused = false
            self.progress = 1.0
        }
    }

    public nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        Task { @MainActor in
            self.isSpeaking = false
            self.isPaused = false
            self.progress = 0
        }
    }

    public nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer,
                                              willSpeakRangeOfSpeechString characterRange: NSRange,
                                              utterance: AVSpeechUtterance) {
        let total = max(1, utterance.speechString.count)
        let pos = min(total, characterRange.location + characterRange.length)
        Task { @MainActor in self.progress = Double(pos) / Double(total) }
    }
}
