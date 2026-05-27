//
//  DeepfakeView.swift
//  IsItSafe
//
//  V3-A1 语音深伪检测主入口（A1-P1）
//

import SwiftUI

public struct DeepfakeView: View {
    @Environment(\.dismiss) private var dismiss
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    @State private var history: [DeepfakeCheck] = []
    @State private var loading = true
    @State private var showRecord = false
    @State private var showResult: DeepfakeCheck?

    public init() {}

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    heroCard
                    entriesSection
                    Divider().padding(.vertical, 8)
                    historySection
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 16)
            }
            .background(AppTheme.background.ignoresSafeArea())
            .navigationTitle(languageCode == "en" ? "Voice Deepfake" : "语音深伪检测")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button { dismiss() } label: {
                        HStack {
                            Image(systemName: "chevron.left").font(.system(size: 17, weight: .semibold))
                            Text(languageCode == "en" ? "Back" : "返回")
                        }.foregroundColor(AppTheme.primary)
                    }
                }
            }
            .task { await loadHistory() }
            .sheet(isPresented: $showRecord, onDismiss: { Task { await loadHistory() } }) {
                DeepfakeRecordSheet { check in
                    showRecord = false
                    showResult = check
                }
            }
            .sheet(item: $showResult, onDismiss: { Task { await loadHistory() } }) { c in
                DeepfakeResultView(check: c)
            }
        }
    }

    private var heroCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(languageCode == "en" ? "2026's biggest scam type" : "2026 最大诈骗类型")
                .font(.caption)
                .opacity(0.9)
            Text(languageCode == "en"
                 ? "AI voice cloning scams ↑ 1,600%"
                 : "AI 语音克隆诈骗 ↑ 1,600%")
                .font(.title3.weight(.bold))
            Text(languageCode == "en"
                 ? "3 seconds of audio is enough for 85% similarity cloning."
                 : "仅需 3 秒音频即可生成 85% 相似度的声音克隆")
                .font(.caption)
                .opacity(0.92)
            HStack(spacing: 6) {
                Image(systemName: "lightbulb.fill")
                    .font(.system(size: 12))
                Text(languageCode == "en"
                     ? "AI assists; always verify by video call or in-person."
                     : "AI 仅辅助判断，请通过视频通话或当面核实")
                    .font(.caption2)
            }
            .padding(8)
            .background(Color.white.opacity(0.15))
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .foregroundColor(.white)
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            LinearGradient(colors: [AppTheme.primary, AppTheme.premiumHeader],
                           startPoint: .topLeading, endPoint: .bottomTrailing)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private var entriesSection: some View {
        VStack(spacing: 10) {
            entryCard(
                icon: "mic.fill",
                title: languageCode == "en" ? "Live recording" : "现场录音",
                desc: languageCode == "en" ? "On call → tap to record 10-60s" : "通话中 → 录 10-60 秒",
                primary: true,
                action: { showRecord = true }
            )
            entryCard(
                icon: "doc.fill",
                title: languageCode == "en" ? "Upload audio file" : "上传音频文件",
                desc: languageCode == "en" ? "mp3 / m4a / aac / wav · ≤ 60s" : "支持 mp3 / m4a · 最长 60s",
                primary: false,
                action: { showRecord = true } // 一期共用 record sheet 即可
            )
            entryCard(
                icon: "square.and.arrow.up.fill",
                title: languageCode == "en" ? "Share from WeChat / iMessage" : "从微信/iMessage 分享",
                desc: languageCode == "en"
                    ? "Long-press a voice → Share → StarLens"
                    : "长按对方语音 → 分享 → StarLens",
                primary: false,
                action: {}
            )
        }
    }

    @ViewBuilder
    private func entryCard(icon: String, title: String, desc: String, primary: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.system(size: 22))
                    .foregroundColor(primary ? .white : AppTheme.primary)
                    .frame(width: 44, height: 44)
                    .background(primary ? AppTheme.primary : AppTheme.primary.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(.subheadline.weight(.semibold))
                        .foregroundColor(AppTheme.textPrimary)
                    Text(desc).font(.caption)
                        .foregroundColor(AppTheme.textSecondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .foregroundColor(AppTheme.textSecondary)
                    .font(.system(size: 14))
            }
            .padding(12)
            .background(AppTheme.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(primary ? AppTheme.primary.opacity(0.3) : Color.clear, lineWidth: 1.5)
            )
        }
    }

    private var historySection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(languageCode == "en" ? "Recent checks" : "最近检测")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Text("\(history.count)")
                    .font(.caption)
                    .foregroundColor(AppTheme.textSecondary)
            }
            if loading {
                ProgressView().frame(maxWidth: .infinity)
            } else if history.isEmpty {
                Text(languageCode == "en" ? "No checks yet" : "暂无检测记录")
                    .font(.caption)
                    .foregroundColor(AppTheme.textSecondary)
                    .padding(.vertical, 12)
            } else {
                ForEach(history) { check in
                    Button {
                        showResult = check
                    } label: {
                        historyRow(check)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func historyRow(_ c: DeepfakeCheck) -> some View {
        HStack(spacing: 10) {
            Circle()
                .fill(labelColor(c.resultLabel).opacity(0.15))
                .frame(width: 40, height: 40)
                .overlay(
                    Text(c.resultLabel.map { l in "\(Int((c.resultScore ?? 0) * 100))%" } ?? "...")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(labelColor(c.resultLabel))
                )
            VStack(alignment: .leading, spacing: 2) {
                Text(sourceLabel(c.sourceType))
                    .font(.subheadline.weight(.medium))
                if let dur = c.fileDurationSec {
                    Text("\(dur)s · \(timeAgo(c.createdAt))")
                        .font(.caption)
                        .foregroundColor(AppTheme.textSecondary)
                } else {
                    Text(timeAgo(c.createdAt))
                        .font(.caption)
                        .foregroundColor(AppTheme.textSecondary)
                }
            }
            Spacer()
            if let lbl = c.resultLabel {
                Text(severityShort(lbl))
                    .font(.caption2.weight(.bold))
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(labelColor(lbl).opacity(0.15))
                    .foregroundColor(labelColor(lbl))
                    .clipShape(Capsule())
            } else {
                Text(c.status)
                    .font(.caption2)
                    .foregroundColor(AppTheme.textSecondary)
            }
        }
        .padding(10)
        .background(AppTheme.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private func labelColor(_ l: DeepfakeLabel?) -> Color {
        switch l {
        case .high: return AppTheme.riskHigh
        case .medium: return AppTheme.riskMedium
        case .low: return AppTheme.riskLow
        case .none: return AppTheme.textSecondary
        }
    }

    private func severityShort(_ l: DeepfakeLabel) -> String {
        switch l {
        case .high: return languageCode == "en" ? "HIGH" : "高危"
        case .medium: return languageCode == "en" ? "SUS" : "可疑"
        case .low: return languageCode == "en" ? "REAL" : "真人"
        }
    }

    private func sourceLabel(_ src: String) -> String {
        switch src {
        case "record": return languageCode == "en" ? "Live recording" : "现场录音"
        case "upload": return languageCode == "en" ? "Uploaded file" : "文件上传"
        case "share":  return languageCode == "en" ? "Shared" : "分享"
        default: return src
        }
    }

    private func timeAgo(_ iso: String?) -> String {
        guard let iso else { return "" }
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var date = f.date(from: iso)
        if date == nil {
            let f2 = ISO8601DateFormatter()
            f2.formatOptions = [.withInternetDateTime]
            date = f2.date(from: iso)
        }
        guard let d = date else { return "" }
        let dt = -d.timeIntervalSinceNow
        if dt < 60 { return "刚刚" }
        if dt < 3600 { return "\(Int(dt / 60)) 分钟前" }
        if dt < 86400 { return "\(Int(dt / 3600)) 小时前" }
        return "\(Int(dt / 86400)) 天前"
    }

    private func loadHistory() async {
        loading = true
        do {
            history = try await DeepfakeRepository.shared.getHistory()
        } catch {
            history = []
        }
        loading = false
    }
}

// 让 DeepfakeCheck 可被 sheet(item:) 使用
extension DeepfakeCheck {
    public var sheetId: String { id }
}
