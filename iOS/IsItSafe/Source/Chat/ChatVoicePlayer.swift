//
//  ChatVoicePlayer.swift
//  IsItSafe
//
//  V5.1 家庭 IM 语音消息播放（远程 m4a 直接流式播放）。
//

import AVFoundation
import Combine
import Foundation

@MainActor
public final class ChatVoicePlayer: ObservableObject {
    public static let shared = ChatVoicePlayer()

    /// 当前正在播放的语音 url（供气泡显示播放动画）；nil = 未播放
    @Published public private(set) var playingURL: String?

    private var player: AVPlayer?
    private var endObserver: NSObjectProtocol?

    private init() {}

    public func toggle(urlString: String) {
        if playingURL == urlString {
            stop()
        } else {
            play(urlString: urlString)
        }
    }

    private func play(urlString: String) {
        guard let url = URL(string: urlString) else { return }
        stop()
        #if os(iOS)
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, options: [.duckOthers])
            try AVAudioSession.sharedInstance().setActive(true)
        } catch { /* 播放失败不致命 */ }
        #endif
        let p = AVPlayer(url: url)
        player = p
        playingURL = urlString
        endObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime, object: p.currentItem, queue: .main
        ) { [weak self] _ in
            Task { @MainActor in self?.stop() }
        }
        p.play()
    }

    public func stop() {
        player?.pause()
        player = nil
        playingURL = nil
        if let obs = endObserver {
            NotificationCenter.default.removeObserver(obs)
            endObserver = nil
        }
        #if os(iOS)
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        #endif
    }
}
