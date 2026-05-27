//
//  AudioRecorderService.swift
//  IsItSafe
//
//  V3-A1 真实录音封装：AVAudioRecorder → m4a 文件
//

import Foundation
import AVFoundation
import Combine

@MainActor
public final class AudioRecorderService: NSObject, ObservableObject {
    @Published public private(set) var isRecording = false
    @Published public private(set) var elapsedSeconds: Int = 0
    @Published public private(set) var meterDb: Float = -160 // 实时音量，用于波形动画

    private var recorder: AVAudioRecorder?
    private var fileURL: URL?
    private var timer: Timer?
    private var meterTimer: Timer?

    public override init() { super.init() }

    /// 申请录音权限
    public func requestPermission() async -> Bool {
        await withCheckedContinuation { cont in
            AVAudioApplication.requestRecordPermission { granted in
                cont.resume(returning: granted)
            }
        }
    }

    /// 开始录音；返回 false 表示权限/初始化失败
    public func start() async -> Bool {
        let granted = await requestPermission()
        guard granted else { return false }

        #if os(iOS)
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetooth])
            try session.setActive(true)
        } catch {
            return false
        }
        #endif

        let tmpDir = FileManager.default.temporaryDirectory
        let url = tmpDir.appendingPathComponent("deepfake_\(UUID().uuidString).m4a")
        fileURL = url

        let settings: [String: Any] = [
            AVFormatIDKey: kAudioFormatMPEG4AAC,
            AVSampleRateKey: 22050.0,  // 22.05kHz 单声道足够语音分析
            AVNumberOfChannelsKey: 1,
            AVEncoderAudioQualityKey: AVAudioQuality.medium.rawValue,
        ]

        do {
            let r = try AVAudioRecorder(url: url, settings: settings)
            r.delegate = self
            r.isMeteringEnabled = true
            guard r.prepareToRecord() else {
                cleanupOnStartFailure()
                return false
            }
            // 硬上限 60s：即使 Timer 失效或 app 切后台，录音也不会无限延长
            guard r.record(forDuration: 60.0) else {
                cleanupOnStartFailure()
                return false
            }
            recorder = r
            isRecording = true
            elapsedSeconds = 0
            startTimers()
            return true
        } catch {
            cleanupOnStartFailure()
            return false
        }
    }

    /// 停止录音，返回本地文件 URL（外部上传后应自行删除文件）
    public func stop() -> URL? {
        stopTimers()
        recorder?.stop()
        let url = fileURL
        recorder = nil
        isRecording = false
        deactivateSession()
        return url
    }

    public func cancel() {
        stopTimers()
        recorder?.stop()
        if let url = fileURL {
            try? FileManager.default.removeItem(at: url)
        }
        recorder = nil
        fileURL = nil
        isRecording = false
        // 与 stop() 对齐：cancel 也需释放 session，否则会持续占麦克风并 duck 其他音频
        deactivateSession()
    }

    private func deactivateSession() {
        #if os(iOS)
        try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
        #endif
    }

    private func cleanupOnStartFailure() {
        if let url = fileURL {
            try? FileManager.default.removeItem(at: url)
        }
        fileURL = nil
        deactivateSession()
    }

    private func startTimers() {
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.elapsedSeconds += 1
            }
        }
        // 0.25s 节流 meter 更新：肉眼几乎察觉不到差异，CPU 占用明显降低
        meterTimer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self else { return }
                self.recorder?.updateMeters()
                self.meterDb = self.recorder?.averagePower(forChannel: 0) ?? -160
            }
        }
    }

    private func stopTimers() {
        timer?.invalidate()
        timer = nil
        meterTimer?.invalidate()
        meterTimer = nil
    }
}

extension AudioRecorderService: AVAudioRecorderDelegate {
    nonisolated public func audioRecorderDidFinishRecording(_ recorder: AVAudioRecorder, successfully flag: Bool) {
        // 由调用方主动 stop()，这里不再做额外处理
    }
}
