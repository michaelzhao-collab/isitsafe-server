//
//  ElderDetectionView.swift
//  IsItSafe
//
//  V3-J 长辈检测入口（J-P2 + J-P3 结果页合一）
//  3 大输入方式：拍照（OCR） / 现场录音转文字 / 长按说话
//  结果用大圆环 + TTS 自动朗读
//

import SwiftUI

public struct ElderDetectionView: View {
    @Environment(\.dismiss) private var dismiss
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    @StateObject private var vm = HomeViewModel()
    @StateObject private var tts = TTSService.shared
    @State private var showCamera = false
    @State private var showPhotoLibrary = false
    @State private var resultText: String?
    @State private var resultLabel: ResultLabel?

    public init() {}

    public enum ResultLabel {
        case high, medium, low

        var color: Color {
            switch self {
            case .high: return AppTheme.riskHigh
            case .medium: return AppTheme.riskMedium
            case .low: return AppTheme.riskLow
            }
        }

        var displayName: String {
            switch self {
            case .high: return "高危"
            case .medium: return "可疑"
            case .low: return "安全"
            }
        }
    }

    public var body: some View {
        NavigationStack {
            ZStack {
                AppTheme.background.ignoresSafeArea()
                if resultText == nil {
                    inputView
                } else {
                    resultView
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button {
                        tts.stop()
                        dismiss()
                    } label: {
                        HStack {
                            Image(systemName: "chevron.left").font(.system(size: 20, weight: .semibold))
                            Text(languageCode == "en" ? "Back" : "返回").font(.system(size: 18))
                        }.foregroundColor(AppTheme.primary)
                    }
                }
                ToolbarItem(placement: .principal) {
                    Text(resultText == nil
                         ? (languageCode == "en" ? "Check it" : "检测一下")
                         : (languageCode == "en" ? "Result" : "检测结果"))
                        .font(.system(size: 20, weight: .semibold))
                }
            }
        }
    }

    // MARK: - 输入页（J-P2）

    private var inputView: some View {
        ScrollView {
            VStack(spacing: 16) {
                Text(languageCode == "en"
                     ? "Pick one, I'll check for you"
                     : "选一个方法，让我帮您看看")
                    .font(.system(size: 18))
                    .foregroundColor(AppTheme.textSecondary)
                    .padding(.top, 8)

                inputCard(
                    icon: "📷",
                    title: languageCode == "en" ? "Take a photo" : "拍照检测",
                    desc: languageCode == "en" ? "Snap suspicious SMS / link / ad" : "拍一下可疑的短信、链接、广告",
                    primary: true,
                    // 一期与其他入口一致走 stub；二期接 PhotosPicker + Vision OCR + 已有 AI 分析
                    action: { stubResult() }
                )

                inputCard(
                    icon: "🎤",
                    title: languageCode == "en" ? "Speak it" : "说一下",
                    desc: languageCode == "en" ? "Tell me what they said on the phone" : "把对方电话里说的话告诉我",
                    primary: false,
                    action: { stubResult() }
                )

                inputCard(
                    icon: "🎧",
                    title: languageCode == "en" ? "Upload recording" : "录音上传",
                    desc: languageCode == "en" ? "Upload a voice message you received" : "上传对方发来的语音消息",
                    primary: false,
                    action: { stubResult() }
                )
            }
            .padding(.horizontal, 18)
            .padding(.bottom, 24)
        }
    }

    private func inputCard(icon: String, title: String, desc: String, primary: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Text(icon).font(.system(size: 56))
                Text(title)
                    .font(.system(size: 22, weight: .bold))
                    .foregroundColor(primary ? AppTheme.primary : AppTheme.textPrimary)
                Text(desc)
                    .font(.system(size: 15))
                    .foregroundColor(AppTheme.textSecondary)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 22)
            .padding(.horizontal, 16)
            .background(AppTheme.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(primary ? AppTheme.primary : Color.clear, lineWidth: 2)
            )
        }
    }

    // MARK: - 结果页（J-P3）

    private var resultView: some View {
        ScrollView {
            VStack(spacing: 20) {
                // TTS 状态条
                ttsStatusBar
                    .padding(.horizontal, 18)
                    .padding(.top, 12)

                // 大圆环
                bigGauge

                // 检测内容回显
                if let txt = resultText {
                    contentRecallCard(text: txt)
                }

                // 警告卡
                warningCard

                // 操作按钮
                actionButtons
            }
            .padding(.bottom, 32)
        }
        .onAppear {
            // 自动朗读结果
            if let label = resultLabel {
                let spoken = ttsScript(for: label)
                Task { @MainActor in
                    try? await Task.sleep(nanoseconds: 300_000_000)
                    tts.speak(spoken, language: languageCode)
                }
            }
        }
        .onDisappear { tts.stop() }
    }

    private var ttsStatusBar: some View {
        HStack(spacing: 12) {
            Text(tts.isSpeaking && !tts.isPaused ? "🔊" : "🔈")
                .font(.system(size: 28))
            VStack(alignment: .leading, spacing: 6) {
                Text(tts.isSpeaking
                     ? (languageCode == "en" ? "Speaking..." : "正在为您朗读")
                     : (languageCode == "en" ? "Press to listen" : "点这里听一遍"))
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(AppTheme.primary)
                ProgressView(value: tts.progress)
                    .progressViewStyle(.linear)
                    .tint(AppTheme.primary)
            }
            Button {
                if tts.isSpeaking {
                    tts.togglePause()
                } else if let label = resultLabel {
                    tts.speak(ttsScript(for: label), language: languageCode)
                }
            } label: {
                Text(tts.isPaused
                     ? (languageCode == "en" ? "▶ Resume" : "▶ 继续")
                     : (tts.isSpeaking
                        ? (languageCode == "en" ? "⏸ Pause" : "⏸ 暂停")
                        : (languageCode == "en" ? "▶ Play" : "▶ 播放")))
                    .font(.system(size: 14, weight: .semibold))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(Color.white)
                    .foregroundColor(AppTheme.primary)
                    .clipShape(Capsule())
            }
        }
        .padding(14)
        .background(AppTheme.premiumWhyCard.opacity(0.5))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private var bigGauge: some View {
        let label = resultLabel ?? .medium
        let color = label.color
        return ZStack {
            Circle()
                .stroke(Color.gray.opacity(0.15), lineWidth: 16)
                .frame(width: 220, height: 220)
            Circle()
                .trim(from: 0, to: label == .high ? 0.9 : label == .medium ? 0.5 : 0.1)
                .stroke(color, style: StrokeStyle(lineWidth: 16, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .frame(width: 220, height: 220)
            VStack(spacing: 6) {
                Text(label.displayName)
                    .font(.system(size: 48, weight: .heavy))
                    .foregroundColor(color)
                Text(label == .high
                     ? (languageCode == "en" ? "Likely a scam" : "非常可能是骗子")
                     : label == .medium
                     ? (languageCode == "en" ? "Be careful" : "请保持警惕")
                     : (languageCode == "en" ? "Looks safe" : "看起来安全"))
                    .font(.system(size: 16))
                    .foregroundColor(AppTheme.textSecondary)
            }
        }
        .padding(.vertical, 8)
    }

    private func contentRecallCard(text: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(languageCode == "en" ? "📞 What you entered" : "📞 您输入的内容")
                .font(.system(size: 15))
                .foregroundColor(AppTheme.textSecondary)
            Text(text)
                .font(.system(size: 22, weight: .bold, design: .monospaced))
                .foregroundColor(AppTheme.textPrimary)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.systemGray6))
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .padding(.horizontal, 18)
    }

    private var warningCard: some View {
        let label = resultLabel ?? .medium
        return VStack(alignment: .leading, spacing: 10) {
            Text(label == .high
                 ? "⚠️ 千万不要按对方说的做"
                 : label == .medium
                 ? "❓ 拿不准的话，可以问问孩子"
                 : "✅ 暂未发现风险")
                .font(.system(size: 19, weight: .bold))
                .foregroundColor(label.color)
            Text(label == .high
                 ? "这是常见的诈骗手段。真的警察、官方机构不会让你转钱到\"安全账户\"。"
                 : label == .medium
                 ? "不确定的事情多问几个人，特别是孩子。"
                 : "但还是要小心，遇到要钱的事都先停一停。")
                .font(.system(size: 17))
                .foregroundColor(AppTheme.textPrimary)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(label.color.opacity(0.08))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(label.color.opacity(0.3), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .padding(.horizontal, 18)
    }

    private var actionButtons: some View {
        VStack(spacing: 14) {
            Button {
                tts.stop()
                dismiss()
                // 触发拨打第一 guardian（外层 ElderHomeView.onChange 监听）
                NotificationCenter.default.post(name: .elderRequestCallGuardian, object: nil)
            } label: {
                Text("📞 立刻给孩子打电话")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 20)
                    .background(AppTheme.riskLow)
                    .clipShape(RoundedRectangle(cornerRadius: 16))
            }
            Button {
                tts.stop()
                resultText = nil
                resultLabel = nil
            } label: {
                Text("🔍 再检测一个")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundColor(AppTheme.primary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 18)
                    .background(AppTheme.primary.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 16))
            }
        }
        .padding(.horizontal, 18)
        .padding(.top, 8)
    }

    // MARK: - 简化的"分析"入口（一期 stub）

    private func stubResult() {
        // J 一期复用 V2 的 AI 检测能力；这里仅作 UI demo
        // 二期接入：拍照 → Vision OCR → 走 /api/ai/analyze（已有）→ 拿真实 result
        resultText = "+86 138-0000-1234"
        resultLabel = .high
    }

    private func ttsScript(for label: ResultLabel) -> String {
        if languageCode == "en" {
            switch label {
            case .high: return "Warning! This is very likely a scam. Do not do what they tell you. Please call your child to confirm."
            case .medium: return "We're not sure. Better ask your child before taking any action."
            case .low: return "No obvious risk found, but stay alert if money is involved."
            }
        }
        switch label {
        case .high: return "您要小心了，这个号码非常可能是骗子。千万不要按对方说的做，可以给孩子打电话问一下。"
        case .medium: return "我们不能完全确定。拿不准的话，建议给孩子打电话问一下。"
        case .low: return "暂时没有发现风险。但是遇到要钱的事情，还是要小心一点。"
        }
    }
}

public extension Notification.Name {
    static let elderRequestCallGuardian = Notification.Name("elder.requestCallGuardian")
    /// V3 #5：聊天里点"查个号码"等触发 → 主页输入框获取焦点
    static let focusHomeInput = Notification.Name("home.focusInput")
}
