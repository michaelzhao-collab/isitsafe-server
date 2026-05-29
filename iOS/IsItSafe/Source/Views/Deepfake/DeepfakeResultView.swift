//
//  DeepfakeResultView.swift
//  IsItSafe
//
//  V3-A1 检测结果（A1-P4）：圆环 + 特征 + 建议 + 反馈
//

import SwiftUI

public struct DeepfakeResultView: View {
    public let check: DeepfakeCheck
    @Environment(\.dismiss) private var dismiss
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    @State private var feedbackSent = false
    @State private var broadcasting = false
    @State private var broadcastMessage: String?

    public init(check: DeepfakeCheck) { self.check = check }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 18) {
                    gauge
                    labelTitle
                    if let features = check.resultFeatures, !features.isEmpty {
                        featuresSection(features)
                    }
                    adviceCard
                    actionsRow
                    feedbackRow
                }
                .padding(16)
            }
            .background(AppTheme.background.ignoresSafeArea())
            .navigationTitle(languageCode == "en" ? "Result" : "检测结果")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(languageCode == "en" ? "Done" : "完成") { dismiss() }
                }
            }
        }
    }

    private var color: Color {
        switch check.resultLabel {
        case .high: return AppTheme.riskHigh
        case .medium: return AppTheme.riskMedium
        case .low: return AppTheme.riskLow
        case .none: return AppTheme.textSecondary
        }
    }

    private var gauge: some View {
        ZStack {
            Circle()
                .stroke(Color.gray.opacity(0.12), lineWidth: 16)
                .frame(width: 200, height: 200)
            Circle()
                .trim(from: 0, to: check.resultScore ?? 0)
                .stroke(color, style: StrokeStyle(lineWidth: 16, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .frame(width: 200, height: 200)
            VStack(spacing: 4) {
                Text("\(check.scorePercent)%")
                    .font(.system(size: 44, weight: .heavy))
                    .foregroundColor(color)
                Text(languageCode == "en" ? "AI synthesis probability" : "AI 合成概率")
                    .font(.caption)
                    .foregroundColor(AppTheme.textSecondary)
            }
        }
        .padding(.top, 16)
    }

    private var labelTitle: some View {
        VStack(spacing: 4) {
            Text(check.resultLabel?.displayName ?? "...")
                .font(.title3.weight(.bold))
                .foregroundColor(color)
            if let dur = check.fileDurationSec {
                Text(languageCode == "en" ? "\(dur)s analyzed" : "\(dur) 秒已分析")
                    .font(.caption)
                    .foregroundColor(AppTheme.textSecondary)
            }
        }
    }

    private func featuresSection(_ features: [DeepfakeFeature]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(languageCode == "en" ? "Detected features" : "检测到的可疑特征")
                .font(.subheadline.weight(.semibold))
                .foregroundColor(AppTheme.textSecondary)
            VStack(spacing: 0) {
                ForEach(features) { f in
                    featureRow(f)
                    if f.id != features.last?.id {
                        Divider().padding(.leading, 24)
                    }
                }
            }
            .background(AppTheme.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
    }

    private func featureRow(_ f: DeepfakeFeature) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Text("●")
                .foregroundColor(severityToColor(f.severity))
                .padding(.top, 4)
            VStack(alignment: .leading, spacing: 4) {
                Text(f.name)
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(AppTheme.textPrimary)
                Text(f.description)
                    .font(.caption)
                    .foregroundColor(AppTheme.textSecondary)
                    .lineLimit(3)
            }
            Spacer()
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
    }

    private func severityToColor(_ s: String) -> Color {
        switch s {
        case "high": return AppTheme.riskHigh
        case "medium": return AppTheme.riskMedium
        default: return AppTheme.primary
        }
    }

    private var adviceCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(languageCode == "en" ? "⚠️ Recommendation" : "⚠️ 建议")
                .font(.subheadline.weight(.bold))
                .foregroundColor(color)
            ForEach(adviceLines(), id: \.self) { line in
                HStack(alignment: .top, spacing: 6) {
                    Text("•").foregroundColor(color)
                    Text(line)
                        .font(.subheadline)
                        .foregroundColor(AppTheme.textPrimary)
                        .lineSpacing(2)
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(color.opacity(0.08))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(color.opacity(0.25), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func adviceLines() -> [String] {
        if languageCode == "en" {
            switch check.resultLabel {
            case .high:
                return [
                    "Verify the person via video call or in person.",
                    "Do NOT transfer money or share verification codes.",
                    "If already transferred → call 96110 immediately.",
                ]
            case .medium:
                return [
                    "AI can't fully decide. Treat with caution.",
                    "Confirm via another channel before action.",
                ]
            case .low:
                return [
                    "AI synthesis is unlikely. Stay alert if money is involved.",
                ]
            case .none:
                return ["Result pending"]
            }
        }
        switch check.resultLabel {
        case .high:
            return [
                "通过视频通话或当面确认对方身份",
                "不要按对方指引转账或泄露验证码",
                "如已转账 → 立刻拨打 96110",
            ]
        case .medium:
            return [
                "AI 无法 100% 确定，请谨慎对待",
                "通过其他渠道（视频/当面）核实",
            ]
        case .low:
            return [
                "AI 合成可能性低，但涉及金钱仍需警惕",
            ]
        case .none:
            return ["结果生成中"]
        }
    }

    private var actionsRow: some View {
        VStack(spacing: 8) {
            Button {
                guard !broadcasting else { return }
                broadcasting = true
                broadcastMessage = nil
                Task {
                    do {
                        let result = try await DeepfakeRepository.shared.broadcastToFamily(taskId: check.id)
                        await MainActor.run {
                            broadcasting = false
                            broadcastMessage = result.userMessage
                        }
                    } catch {
                        await MainActor.run {
                            broadcasting = false
                            broadcastMessage = languageCode == "en"
                                ? "Broadcast failed, try again later"
                                : "广播失败，请稍后重试"
                        }
                    }
                }
            } label: {
                HStack {
                    if broadcasting {
                        ProgressView().tint(.white)
                    } else {
                        Image(systemName: "megaphone.fill")
                    }
                    Text(languageCode == "en" ? "Broadcast to Family" : "广播到家庭")
                }
                .font(.body.weight(.semibold))
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(AppTheme.primary.opacity(broadcasting ? 0.6 : 1.0))
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .disabled(broadcasting)
            if let msg = broadcastMessage {
                Text(msg)
                    .font(.caption)
                    .foregroundColor(AppTheme.textSecondary)
                    .transition(.opacity)
            }
        }
    }

    private var feedbackRow: some View {
        VStack(spacing: 6) {
            if feedbackSent {
                Text(languageCode == "en" ? "Thanks for feedback ❤️" : "感谢反馈 ❤️")
                    .font(.caption)
                    .foregroundColor(AppTheme.textSecondary)
            } else {
                Text(languageCode == "en" ? "Was this accurate?" : "这个判断准吗？")
                    .font(.caption)
                    .foregroundColor(AppTheme.textSecondary)
                HStack(spacing: 12) {
                    Button {
                        Task { try? await DeepfakeRepository.shared.submitFeedback(taskId: check.id, accurate: true) }
                        feedbackSent = true
                    } label: {
                        Text("👍 \(languageCode == "en" ? "Accurate" : "准")")
                            .font(.subheadline)
                            .padding(.horizontal, 14).padding(.vertical, 6)
                            .background(AppTheme.riskLow.opacity(0.12))
                            .foregroundColor(AppTheme.riskLow)
                            .clipShape(Capsule())
                    }
                    Button {
                        Task { try? await DeepfakeRepository.shared.submitFeedback(taskId: check.id, accurate: false) }
                        feedbackSent = true
                    } label: {
                        Text("👎 \(languageCode == "en" ? "Inaccurate" : "不准")")
                            .font(.subheadline)
                            .padding(.horizontal, 14).padding(.vertical, 6)
                            .background(AppTheme.riskHigh.opacity(0.12))
                            .foregroundColor(AppTheme.riskHigh)
                            .clipShape(Capsule())
                    }
                }
            }
        }
        .padding(.top, 8)
    }
}
