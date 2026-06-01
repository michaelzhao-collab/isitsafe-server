//
//  VoiceRecordingOverlay.swift
//  IsItSafe
//
//  按住说话的全屏录音浮层（类微信简洁版）
//  - 半透明黑遮罩
//  - 中央绿色气泡 + 波形动画
//  - 下方"上滑取消"hint，进入取消态后变红 X
//  - 底部"松开 发送"
//  无"转文字"按钮（我们的语音本来就转文字给 AI 分析）
//

import SwiftUI

public struct VoiceRecordingOverlay: View {
    /// 是否处于"上滑取消"模式（手指上滑超过阈值）
    public let isCancellable: Bool
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"

    /// 8 个波形条的动态高度（0.2 ~ 1.0）
    @State private var barLevels: [CGFloat] = Array(repeating: 0.3, count: 8)
    @State private var waveTimer: Timer?

    public init(isCancellable: Bool) {
        self.isCancellable = isCancellable
    }

    public var body: some View {
        ZStack {
            // 半透明黑遮罩
            Color.black.opacity(0.55)
                .ignoresSafeArea()

            VStack(spacing: 28) {
                Spacer()

                // 中央气泡：取消态变灰红，正常态绿色
                ZStack(alignment: .bottom) {
                    bubble
                    // 下方小三角箭头
                    Triangle()
                        .fill(isCancellable ? Color.red.opacity(0.85) : Color.green.opacity(0.85))
                        .frame(width: 18, height: 10)
                        .offset(y: 10)
                }

                // 中间提示文案
                VStack(spacing: 12) {
                    if isCancellable {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 36))
                            .foregroundColor(.white)
                            .padding(14)
                            .background(Circle().fill(Color.red.opacity(0.8)))
                        Text(languageCode == "en" ? "Release to cancel" : "松开手指 取消录音")
                            .font(.subheadline.weight(.semibold))
                            .foregroundColor(.white)
                    } else {
                        Image(systemName: "chevron.up")
                            .font(.system(size: 18, weight: .bold))
                            .foregroundColor(.white.opacity(0.85))
                        Text(languageCode == "en" ? "Slide up to cancel" : "上滑取消")
                            .font(.subheadline.weight(.semibold))
                            .foregroundColor(.white.opacity(0.85))
                    }
                }

                Spacer()

                // 底部"松开 发送"提示
                Text(languageCode == "en" ? "Release to send" : "松开 发送")
                    .font(.footnote)
                    .foregroundColor(.white.opacity(0.7))
                    .padding(.bottom, 140) // 给 tabBar + 输入栏留位置，浮在按钮上方
            }
        }
        .transition(.opacity)
        .onAppear { startWaveform() }
        .onDisappear { stopWaveform() }
    }

    private var bubble: some View {
        HStack(spacing: 4) {
            ForEach(0..<8, id: \.self) { i in
                Capsule()
                    .fill(Color.white)
                    .frame(width: 4, height: 36 * barLevels[i])
                    .animation(.easeInOut(duration: 0.18), value: barLevels[i])
            }
        }
        .frame(width: 180, height: 70)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(isCancellable ? Color.red.opacity(0.85) : Color.green.opacity(0.85))
        )
    }

    private func startWaveform() {
        stopWaveform()
        waveTimer = Timer.scheduledTimer(withTimeInterval: 0.15, repeats: true) { _ in
            barLevels = (0..<8).map { _ in CGFloat.random(in: 0.25...1.0) }
        }
    }
    private func stopWaveform() {
        waveTimer?.invalidate()
        waveTimer = nil
    }
}

/// 气泡下方三角小箭头
private struct Triangle: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: rect.midX, y: rect.maxY))
        p.addLine(to: CGPoint(x: rect.minX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        p.closeSubpath()
        return p
    }
}
