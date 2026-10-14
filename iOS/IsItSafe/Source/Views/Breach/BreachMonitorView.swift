//
//  BreachMonitorView.swift
//  IsItSafe
//
//  V3-F 数据泄露监控主页（仅海外用户在 ProfileView 看得到入口；2026-10-14 由「暗网监控」改名）
//

import Combine
import SwiftUI

public struct BreachMonitorView: View {
    @EnvironmentObject private var appState: AppStateViewModel
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    @State private var targets: [BreachTargetItem] = []
    @State private var alerts: [BreachAlert] = []
    @State private var allAlerts: [BreachAlert] = []
    @State private var loading = true
    @State private var loadError: String?
    @State private var showAdd = false
    @State private var showUpgrade = false
    @State private var showPremium = false
    @State private var verifyTarget: BreachTargetItem?
    /// 串联弹窗：上一个 sheet 完全消失（onDismiss）后再弹下一个（asyncAfter 在 sheet 未退完时 present 会失败）
    @State private var pendingUpgradeAfterAdd = false
    @State private var pendingPremiumAfterUpgrade = false

    /// 免费用户最多 1 个 target；Pro 5 个（与服务端一致）
    private let freeTargetLimit = 1

    public init() {}

    /// 2026-10-06：本页由「我的」页 navigationDestination 推入，系统已提供返回按钮。
    public var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                if let err = loadError, targets.isEmpty {
                    errorCard(err)
                } else {
                    statusBanner
                }
                if !alerts.isEmpty {
                    alertsSection
                }
                targetsSection
                sourceFooter
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 16)
        }
        .background(AppTheme.background.ignoresSafeArea())
        .navigationTitle(L10n.tr(zh: "数据泄露监控", en: "Data Breach Monitor"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button { tryShowAdd() } label: { Image(systemName: "plus") }
            }
        }
        .task { await reload() }
        .sheet(isPresented: $showAdd, onDismiss: {
            Task { await reload() }
            if pendingUpgradeAfterAdd { pendingUpgradeAfterAdd = false; showUpgrade = true }
        }) {
            BreachAddTargetSheet(onPlanLimit: {
                // 服务端判定已达上限（客户端会员状态可能滞后）→ 添加页关闭后弹付费墙
                pendingUpgradeAfterAdd = true
            })
        }
        .sheet(item: $verifyTarget, onDismiss: { Task { await reload() } }) { t in
            BreachVerifySheet(targetId: t.id, displayValue: t.displayValue, initialCooldown: 0)
        }
        .sheet(isPresented: $showUpgrade, onDismiss: {
            if pendingPremiumAfterUpgrade { pendingPremiumAfterUpgrade = false; showPremium = true }
        }) {
            // 2026-10-14：原来 onUpgrade 是空闭包，点「升级」只关弹窗
            BreachUpgradeSheet(onUpgrade: { pendingPremiumAfterUpgrade = true })
        }
        .sheet(isPresented: $showPremium, onDismiss: { Task { await reload() } }) {
            NavigationStack {
                PremiumSubscriptionView()
                    .environmentObject(appState)
            }
        }
        .refreshable { await reload() }
    }

    // MARK: - 状态横幅（2026-10-14：只有全部邮箱扫描成功且确实没查到时才显示绿色「安全」）

    private enum BannerState { case empty, safe, atRisk, scanIssue, pending }

    private var bannerState: BannerState {
        if targets.isEmpty { return .empty }
        if !alerts.isEmpty { return .atRisk }
        let statuses = targets.map { $0.effectiveScanStatus }
        if statuses.contains("failed") { return .scanIssue }
        // 只要还有没扫描过（待验证 / 待首次扫描）的邮箱，就不显示绿色「安全」
        if statuses.contains(where: { $0 != "ok" }) { return .pending }
        return .safe
    }

    private var statusBanner: some View {
        let (title, subtitle, colors): (String, String, [Color]) = {
            switch bannerState {
            case .empty:
                return (L10n.tr(zh: "还没有监控的邮箱", en: "No emails monitored yet"),
                        L10n.tr(zh: "添加邮箱，我们每天帮你查它是否出现在数据泄露中", en: "Add an email and we'll check it against known data breaches every day"),
                        AppTheme.brandGradientColors)
            case .safe:
                return (L10n.tr(zh: "未发现泄露", en: "No breaches found"),
                        lastScanLine,
                        [AppTheme.riskLow, Color(hex: "059669")])
            case .atRisk:
                return (L10n.tr(zh: "你的数据出现在泄露中", en: "Your data appeared in a breach"),
                        alerts.count == 1
                            ? L10n.tr(zh: "1 条待处理警报", en: "1 alert to review")
                            : L10n.tr(zh: "\(alerts.count) 条待处理警报", en: "\(alerts.count) alerts to review"),
                        [AppTheme.riskMedium, AppTheme.riskHigh])
            case .scanIssue:
                return (L10n.tr(zh: "部分邮箱暂时无法扫描", en: "Some emails couldn't be scanned"),
                        L10n.tr(zh: "这不代表安全。我们会在下一次每日扫描时自动重试。", en: "This doesn't mean you're safe. We'll retry in the next daily scan."),
                        [AppTheme.riskMedium, Color(hex: "D97706")])
            case .pending:
                return (L10n.tr(zh: "部分邮箱还未扫描", en: "Some emails haven't been scanned yet"),
                        L10n.tr(zh: "待验证的邮箱验证后开始扫描；其余会在每日扫描时完成", en: "Unverified emails start after verification; the rest are checked in the daily scan"),
                        AppTheme.brandGradientColors)
            }
        }()
        return VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.title3.weight(.bold))
            Text(subtitle).font(.caption).opacity(0.92)
        }
        .foregroundColor(.white)
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(LinearGradient(colors: colors, startPoint: .topLeading, endPoint: .bottomTrailing))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    /// 真实的上次扫描时间（原来写死 "Last scan: just now · Next scan in 23h"）
    private var lastScanLine: String {
        let dates = targets.compactMap { $0.lastScannedAt.flatMap(BreachDates.parse) }
        guard let latest = dates.max() else { return L10n.tr(zh: "每天自动扫描", en: "Scanned automatically every day") }
        return L10n.tr(zh: "上次扫描：\(BreachDates.relative(latest)) · 每天自动扫描", en: "Last scan: \(BreachDates.relative(latest)) · scanned daily")
    }

    private func errorCard(_ msg: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Label(L10n.tr(zh: "加载失败", en: "Couldn't load"), systemImage: "exclamationmark.triangle.fill")
                .font(.headline)
                .foregroundColor(AppTheme.riskMedium)
            Text(msg).font(.subheadline).foregroundColor(AppTheme.textSecondary)
            Button {
                Task { await reload() }
            } label: {
                Text(L10n.tr(zh: "重试", en: "Retry"))
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 18).padding(.vertical, 8)
                    .background(Capsule().fill(AppTheme.brandGradient))
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppTheme.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private var alertsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(L10n.tr(zh: "待处理警报（\(alerts.count)）", en: "Alerts to review (\(alerts.count))"))
                .font(.subheadline.weight(.semibold))
                .foregroundColor(AppTheme.textSecondary)
            ForEach(alerts) { alert in
                NavigationLink {
                    BreachAlertDetailView(alert: alert) { Task { await reload() } }
                } label: {
                    alertCard(alert)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func alertCard(_ a: BreachAlert) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(a.severity.displayName)
                    .font(.caption2.weight(.bold))
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(BreachColors.severity(a.severity).opacity(0.15))
                    .foregroundColor(BreachColors.severity(a.severity))
                    .clipShape(Capsule())
                Spacer()
                if let d = a.breachDate.flatMap(BreachDates.parse) {
                    Text(BreachDates.day(d)).font(.caption2).foregroundColor(AppTheme.textSecondary)
                }
            }
            Text(a.breachName)
                .font(.subheadline.weight(.semibold))
                .foregroundColor(AppTheme.textPrimary)
            Text(a.exposedData.joined(separator: ", "))
                .font(.caption)
                .foregroundColor(AppTheme.textSecondary)
                .lineLimit(2)
        }
        .padding(12)
        .padding(.leading, 4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppTheme.cardBackground)
        .overlay(alignment: .leading) {
            Rectangle().fill(BreachColors.severity(a.severity)).frame(width: 4)
        }
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private var targetsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(L10n.tr(zh: "监控的邮箱（\(targets.count)）", en: "Monitored emails (\(targets.count))"))
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(AppTheme.textSecondary)
                Spacer()
                Button { tryShowAdd() } label: {
                    Label(L10n.tr(zh: "添加", en: "Add"), systemImage: "plus.circle.fill")
                        .font(.caption.weight(.semibold))
                        .foregroundColor(AppTheme.primaryTint)
                }
            }
            if loading && targets.isEmpty {
                ProgressView().frame(maxWidth: .infinity).padding(.vertical, 20)
            } else if targets.isEmpty && loadError == nil {
                Button { tryShowAdd() } label: {
                    VStack(spacing: 6) {
                        Image(systemName: "envelope.badge.shield.half.filled")
                            .font(.system(size: 36))
                            .foregroundColor(AppTheme.primaryTint)
                        Text(L10n.tr(zh: "添加邮箱开始监控", en: "Add an email to start"))
                            .font(.subheadline.weight(.semibold))
                            .foregroundColor(AppTheme.primaryTint)
                        Text(L10n.tr(zh: "免费版 1 个邮箱 · 会员 5 个邮箱", en: "Free: 1 email · Pro: 5 emails"))
                            .font(.caption)
                            .foregroundColor(AppTheme.textSecondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 28)
                    .background(AppTheme.primarySoft)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                }
                .buttonStyle(.plain)
            } else {
                ForEach(targets) { t in
                    if t.effectiveScanStatus == "pending_verification" {
                        Button { verifyTarget = t } label: { targetRow(t) }
                            .buttonStyle(.plain)
                    } else {
                        NavigationLink {
                            BreachTargetDetailView(target: t, allAlerts: allAlerts) { Task { await reload() } }
                        } label: {
                            targetRow(t)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private var sourceFooter: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(L10n.tr(zh: "数据来源：Have I Been Pwned 公开泄露数据库。邮箱加密保存，仅用于查询。",
                         en: "Data from Have I Been Pwned. Your email is stored encrypted and only used for these checks."))
                .font(.caption2)
                .foregroundColor(AppTheme.textSecondary)
            Link("haveibeenpwned.com", destination: URL(string: "https://haveibeenpwned.com")!)
                .font(.caption2.weight(.semibold))
                .foregroundColor(AppTheme.primaryTint)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 4)
    }

    /// 达到免费上限时弹付费墙
    private func tryShowAdd() {
        if !appState.subscriptionActive && targets.count >= freeTargetLimit {
            // 名额被一个还没验证的邮箱占着：先让用户处理它（验证或删除），而不是直接弹付费墙
            if let pending = targets.first(where: { $0.effectiveScanStatus == "pending_verification" }) {
                verifyTarget = pending
                return
            }
            showUpgrade = true
            return
        }
        showAdd = true
    }

    private func targetRow(_ t: BreachTargetItem) -> some View {
        let status = t.effectiveScanStatus
        return HStack(spacing: 12) {
            Image(systemName: "envelope.fill")
                .foregroundColor(AppTheme.Accent.blue.foreground)
                .frame(width: 36, height: 36)
                .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(AppTheme.Accent.blue.soft))
            VStack(alignment: .leading, spacing: 2) {
                Text(t.displayValue)
                    .font(.subheadline.weight(.medium))
                    .foregroundColor(AppTheme.textPrimary)
                Text(rowSubtitle(t, status: status))
                    .font(.caption)
                    .foregroundColor(t.alertCount > 0 ? AppTheme.riskHigh : AppTheme.textSecondary)
            }
            Spacer()
            statusChip(status)
            Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundColor(AppTheme.textSecondary.opacity(0.6))
        }
        .padding(12)
        .background(AppTheme.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func rowSubtitle(_ t: BreachTargetItem, status: String) -> String {
        switch status {
        case "pending_verification": return L10n.tr(zh: "点此输入邮件里的验证码", en: "Tap to enter the code we emailed you")
        case "failed": return L10n.tr(zh: "暂时无法扫描，会自动重试", en: "Couldn't scan yet — we'll retry")
        case "never": return L10n.tr(zh: "等待首次扫描", en: "Waiting for the first scan")
        default:
            return t.alertCount > 0
                ? (t.alertCount == 1 ? L10n.tr(zh: "发现 1 次泄露", en: "Found in 1 breach") : L10n.tr(zh: "发现 \(t.alertCount) 次泄露", en: "Found in \(t.alertCount) breaches"))
                : L10n.tr(zh: "未发现泄露", en: "No breaches found")
        }
    }

    @ViewBuilder
    private func statusChip(_ status: String) -> some View {
        switch status {
        case "ok":
            Image(systemName: "checkmark.seal.fill").foregroundColor(AppTheme.riskLow)
        case "failed":
            chip(L10n.tr(zh: "扫描失败", en: "Scan failed"), AppTheme.riskMedium)
        case "pending_verification":
            chip(L10n.tr(zh: "待验证", en: "Verify"), AppTheme.primaryTint)
        default:
            chip(L10n.tr(zh: "待扫描", en: "Pending"), AppTheme.textSecondary)
        }
    }

    private func chip(_ text: String, _ color: Color) -> some View {
        Text(text)
            .font(.caption2.weight(.bold))
            .padding(.horizontal, 6).padding(.vertical, 2)
            .background(color.opacity(0.15))
            .foregroundColor(color)
            .clipShape(Capsule())
    }

    private func reload() async {
        loading = true
        do {
            async let t = BreachRepository.shared.listTargets()
            async let a = BreachRepository.shared.listAlerts()
            let (targetsResult, alertsResult) = try await (t, a)
            targets = targetsResult
            allAlerts = alertsResult
            alerts = alertsResult.filter { !$0.dismissed }
            loadError = nil
        } catch {
            // 2026-10-14：原来 try? 吞成空数组 → 网络 / 403 / 解码失败都显示「No leaks detected」
            loadError = (error as? APIError)?.userMessage ?? error.localizedDescription
        }
        loading = false
    }
}

// MARK: - 共用：日期 / 颜色

enum BreachDates {
    static func parse(_ s: String) -> Date? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: s) { return d }
        f.formatOptions = [.withInternetDateTime]
        if let d = f.date(from: s) { return d }
        f.formatOptions = [.withFullDate]
        return f.date(from: String(s.prefix(10)))
    }

    /// 泄露日期：按 App 语言显示为「2013年10月4日」/「Oct 4, 2013」
    static func day(_ d: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: L10n.tr(zh: "zh_CN", en: "en_US"))
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateStyle = .medium
        return f.string(from: d)
    }

    static func relative(_ d: Date) -> String {
        let dt = max(0, -d.timeIntervalSinceNow)
        if dt < 60 { return L10n.tr(zh: "刚刚", en: "just now") }
        if dt < 3600 { return L10n.tr(zh: "\(Int(dt / 60)) 分钟前", en: "\(Int(dt / 60))m ago") }
        if dt < 86400 { return L10n.tr(zh: "\(Int(dt / 3600)) 小时前", en: "\(Int(dt / 3600))h ago") }
        return L10n.tr(zh: "\(Int(dt / 86400)) 天前", en: "\(Int(dt / 86400))d ago")
    }
}

enum BreachColors {
    static func severity(_ s: BreachSeverity) -> Color {
        switch s {
        case .high: return AppTheme.riskHigh
        case .medium: return AppTheme.riskMedium
        case .low: return AppTheme.primaryTint
        }
    }
}

// MARK: - 添加邮箱（登录邮箱直接监控；其它邮箱进入验证码步骤）

public struct BreachAddTargetSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var email = ""
    @State private var submitting = false
    @State private var errorMessage: String?
    @State private var pendingTarget: (id: String, display: String)?
    var onPlanLimit: () -> Void = {}

    public init(onPlanLimit: @escaping () -> Void = {}) {
        self.onPlanLimit = onPlanLimit
    }

    private var canSubmit: Bool { email.contains("@") && email.contains(".") && !submitting }

    public var body: some View {
        NavigationStack {
            Group {
                if let p = pendingTarget {
                    BreachVerifyContent(targetId: p.id, displayValue: p.display, onVerified: { dismiss() }, onRemoved: { dismiss() })
                } else {
                    addForm
                }
            }
            .background(AppTheme.background.ignoresSafeArea())
            .navigationTitle(pendingTarget == nil ? L10n.tr(zh: "添加邮箱", en: "Add email") : L10n.tr(zh: "验证邮箱", en: "Verify email"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(L10n.tr(zh: "取消", en: "Cancel")) { dismiss() }
                }
            }
        }
    }

    private var addForm: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(L10n.tr(zh: "监控一个邮箱", en: "Monitor an email"))
                .font(.title3.weight(.bold))
            // 2026-10-14：原文案「经哈希处理、不以明文存储」不准确（实际是可逆加密 + 发给 HIBP 查询）
            Text(L10n.tr(zh: "我们每天把这个邮箱与 Have I Been Pwned 的公开泄露数据库比对。邮箱加密保存，仅用于这项查询。你登录用的邮箱可直接监控；其它邮箱需要输入我们发到该邮箱的验证码，确认是你本人的。",
                         en: "We check this email against the Have I Been Pwned breach database every day. It's stored encrypted and used only for these checks. The email you sign in with is monitored right away; any other email needs a code we send to it, to confirm it's yours."))
                .font(.caption)
                .foregroundColor(AppTheme.textSecondary)
            TextField("you@example.com", text: $email)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .padding(12)
                .background(AppTheme.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(AppTheme.primarySoftBorder, lineWidth: 1))
            if let err = errorMessage {
                Text(err).font(.caption).foregroundColor(AppTheme.riskHigh)
            }
            Spacer()
            Button { submit() } label: {
                HStack {
                    if submitting { ProgressView().tint(.white) }
                    Text(L10n.tr(zh: "开始监控", en: "Start monitoring")).font(.body.weight(.semibold))
                }
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background { AppTheme.brandGradient.opacity(canSubmit ? 1.0 : 0.4) }
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .disabled(!canSubmit)
        }
        .padding(16)
    }

    private func submit() {
        submitting = true
        errorMessage = nil
        Task {
            do {
                let r = try await BreachRepository.shared.addTarget(email: email.trimmingCharacters(in: .whitespacesAndNewlines))
                submitting = false
                if r.needsEmailVerification == true {
                    pendingTarget = (r.id, r.displayValue)
                } else {
                    dismiss()
                }
            } catch {
                submitting = false
                if case APIError.serverError(let code, let msg) = error, code == 409,
                   let m = msg?.lowercased(), m.contains("limit") || m.contains("上限") {
                    dismiss()
                    onPlanLimit()
                    return
                }
                errorMessage = (error as? APIError)?.userMessage ?? error.localizedDescription
            }
        }
    }
}

/// 列表里点「待验证」的邮箱进入
public struct BreachVerifySheet: View {
    let targetId: String
    let displayValue: String
    var initialCooldown: Int = 60
    @Environment(\.dismiss) private var dismiss

    public var body: some View {
        NavigationStack {
            BreachVerifyContent(targetId: targetId, displayValue: displayValue, initialCooldown: initialCooldown,
                                onVerified: { dismiss() }, onRemoved: { dismiss() })
                .background(AppTheme.background.ignoresSafeArea())
                .navigationTitle(L10n.tr(zh: "验证邮箱", en: "Verify email"))
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button(L10n.tr(zh: "关闭", en: "Close")) { dismiss() }
                    }
                }
        }
    }
}

/// 输入 6 位验证码 + 重新发送（60s 冷却）
struct BreachVerifyContent: View {
    let targetId: String
    let displayValue: String
    var initialCooldown: Int = 60
    let onVerified: () -> Void
    var onRemoved: () -> Void = {}
    @State private var code = ""
    @State private var verifying = false
    @State private var removing = false
    @State private var errorMessage: String?
    @State private var info: String?
    @State private var cooldown = 60
    @FocusState private var focused: Bool
    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(L10n.tr(zh: "输入验证码", en: "Enter the code"))
                .font(.title3.weight(.bold))
            Text(L10n.tr(zh: "我们给 \(displayValue) 发了一封邮件，里面有 6 位验证码，30 分钟内有效。没收到请看看垃圾邮件。",
                         en: "We emailed a 6-digit code to \(displayValue). It expires in 30 minutes — check your spam folder if you don't see it."))
                .font(.caption)
                .foregroundColor(AppTheme.textSecondary)
            TextField("000000", text: $code)
                .keyboardType(.numberPad)
                .textContentType(.oneTimeCode)
                .font(.system(size: 28, weight: .semibold, design: .monospaced))
                .multilineTextAlignment(.center)
                .padding(12)
                .background(AppTheme.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(AppTheme.primarySoftBorder, lineWidth: 1))
                .focused($focused)
                .onChange(of: code) { _, v in
                    let digits = String(v.filter(\.isNumber).prefix(6))
                    if digits != v { code = digits }
                    if digits.count == 6 { submit() }
                }
            if let err = errorMessage {
                Text(err).font(.caption).foregroundColor(AppTheme.riskHigh)
            } else if let info {
                Text(info).font(.caption).foregroundColor(AppTheme.riskLow)
            }
            Button { resend() } label: {
                Text(cooldown > 0
                     ? L10n.tr(zh: "\(cooldown) 秒后可重新发送", en: "Resend in \(cooldown)s")
                     : L10n.tr(zh: "重新发送验证码", en: "Resend code"))
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(cooldown > 0 ? AppTheme.textSecondary : AppTheme.primaryTint)
            }
            .disabled(cooldown > 0)
            // 邮箱填错了 / 收不到：删掉这条，名额立刻释放（原来只能等 30 分钟过期）
            Button {
                remove()
            } label: {
                Text(L10n.tr(zh: "邮箱填错了？删除并换一个", en: "Wrong email? Remove it and use another"))
                    .font(.footnote)
                    .foregroundColor(AppTheme.textSecondary)
                    .underline()
            }
            .disabled(removing)
            Spacer()
            Button { submit() } label: {
                HStack {
                    if verifying { ProgressView().tint(.white) }
                    Text(L10n.tr(zh: "验证并开始监控", en: "Verify and start monitoring")).font(.body.weight(.semibold))
                }
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background { AppTheme.brandGradient.opacity(code.count == 6 && !verifying ? 1.0 : 0.4) }
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .disabled(code.count != 6 || verifying)
        }
        .padding(16)
        .onAppear { focused = true; cooldown = initialCooldown }
        .onReceive(timer) { _ in if cooldown > 0 { cooldown -= 1 } }
    }

    private func submit() {
        guard code.count == 6, !verifying else { return }
        verifying = true
        errorMessage = nil
        Task {
            do {
                _ = try await BreachRepository.shared.verify(id: targetId, code: code)
                verifying = false
                onVerified()
            } catch {
                verifying = false
                code = ""
                errorMessage = (error as? APIError)?.userMessage ?? error.localizedDescription
            }
        }
    }

    private func remove() {
        removing = true
        Task {
            do {
                try await BreachRepository.shared.deleteTarget(id: targetId)
                removing = false
                onRemoved()
            } catch {
                removing = false
                errorMessage = (error as? APIError)?.userMessage ?? error.localizedDescription
            }
        }
    }

    private func resend() {
        errorMessage = nil
        info = nil
        Task {
            do {
                let r = try await BreachRepository.shared.resendCode(id: targetId)
                cooldown = r.resendCooldownSeconds ?? 60
                info = L10n.tr(zh: "已重新发送", en: "Code sent")
            } catch {
                errorMessage = (error as? APIError)?.userMessage ?? error.localizedDescription
            }
        }
    }
}

public struct BreachAlertDetailView: View {
    public let alert: BreachAlert
    public let onDismiss: () -> Void
    @Environment(\.dismiss) private var dismissEnv

    public init(alert: BreachAlert, onDismiss: @escaping () -> Void) {
        self.alert = alert
        self.onDismiss = onDismiss
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(alert.severity.displayName)
                        .font(.caption.weight(.heavy))
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(severityColor.opacity(0.15))
                        .foregroundColor(severityColor)
                        .clipShape(Capsule())
                    Text(alert.breachName)
                        .font(.title2.weight(.bold))
                    if let d = alert.breachDate.flatMap(BreachDates.parse) {
                        Text(L10n.tr(zh: "泄露时间：\(BreachDates.day(d))", en: "Breach date: \(BreachDates.day(d))"))
                            .font(.caption)
                            .foregroundColor(AppTheme.textSecondary)
                    }
                }
                VStack(alignment: .leading, spacing: 6) {
                    Text(L10n.tr(zh: "泄露的数据", en: "Your exposed data")).font(.subheadline.weight(.semibold))
                    ForEach(alert.exposedData, id: \.self) { f in
                        HStack {
                            Image(systemName: "exclamationmark.circle.fill").foregroundColor(severityColor)
                            Text(f)
                        }
                        .font(.subheadline)
                    }
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(AppTheme.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: 12))

                VStack(alignment: .leading, spacing: 8) {
                    Text(L10n.tr(zh: "建议操作", en: "Recommended actions")).font(.subheadline.weight(.semibold))
                    Label(L10n.tr(zh: "修改这个网站账号的密码", en: "Change the password on this account"), systemImage: "key.fill")
                    Label(L10n.tr(zh: "为重要账号开启两步验证", en: "Enable 2FA on important accounts"), systemImage: "shield.lefthalf.filled")
                    Label(L10n.tr(zh: "检查银行、邮箱等账号是否用了同一个密码", en: "Check if the same password is used for banking or email"), systemImage: "magnifyingglass")
                }
                .font(.subheadline)
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(AppTheme.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: 12))

                Button {
                    Task {
                        try? await BreachRepository.shared.dismissAlert(id: alert.id)
                        onDismiss()
                        dismissEnv()
                    }
                } label: {
                    Text(L10n.tr(zh: "标记为已处理", en: "Mark as Done"))
                        .font(.body.weight(.semibold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(AppTheme.brandGradient)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
            }
            .padding(16)
        }
        .background(AppTheme.background.ignoresSafeArea())
        .navigationTitle(L10n.tr(zh: "警报", en: "Alert"))
        .navigationBarTitleDisplayMode(.inline)
    }

    private var severityColor: Color { BreachColors.severity(alert.severity) }
}
