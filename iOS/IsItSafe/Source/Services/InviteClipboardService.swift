//
//  InviteClipboardService.swift
//  IsItSafe
//
//  2026-10-06 剪贴板延迟绑定家庭：邀请落地页点「下载」时复制完整邀请链接，用户也可能只复制了 6 位邀请码。
//  App 装好后检测剪贴板，是我们的邀请 → 弹框问是否加入；确认/取消都清空剪贴板。
//  不是我们的邀请 → 不弹我们的框、不清剪贴板。
//
//  平台限制：读取 UIPasteboard.string 会触发系统「允许粘贴」框，App 无法避免。为尽量少打扰：
//    - hasStrings / changeCount 不触发系统框，先用它们过滤：没有文本、或这份内容已检查过 → 不读
//    - 只在首次启动后 24 小时内、且尚未加入任何家庭时检查
//  首页另有一个「剪贴板内容填入输入框」检测，与本服务共用同一次读取结果（见 cachedText），避免连弹两次系统框。
//

import Combine
import UIKit

@MainActor
final class InviteClipboardService: ObservableObject {
    static let shared = InviteClipboardService()

    /// 检测到的邀请码，MainTabView 观察它弹确认框
    @Published var detectedCode: String?

    private let firstLaunchKey = "isitsafe.invite.firstLaunchAt"
    private let lastCheckedKey = "isitsafe.invite.lastCheckedChangeCount"
    private static let checkWindow: TimeInterval = 24 * 3600

    /// 本次进程内已读过的剪贴板内容（按 changeCount 对应），供首页检测复用
    private var readChangeCount: Int?
    private var readText: String?
    /// 弹框对应的剪贴板版本：只有剪贴板还是这份内容时才清空，用户期间又复制了别的就不动
    private var detectedChangeCount: Int?

    private init() {}

    /// App 启动时（IsItSafeApp.init，早于登录）调用，记录检测窗口起点。
    /// 第一次出现这个 key 时本地已有登录 token → 是从旧版本升级上来的老用户，不是新装，直接视为窗口已过期，
    /// 避免所有老用户升级当天反复看到系统「允许粘贴」框。
    static func recordLaunch() {
        let key = "isitsafe.invite.firstLaunchAt"
        guard UserDefaults.standard.object(forKey: key) == nil else { return }
        let upgradedUser = AuthInterceptor.token() != nil
        UserDefaults.standard.set(upgradedUser ? 0 : Date().timeIntervalSince1970, forKey: key)
    }

    /// 是否已在某个家庭里。FamilyChatCoordinator.hasFamily 只在进过家庭 Tab 后才有值，冷启动恒为 false，
    /// 所以再看持久化的当前选中群（FamilyViewModel 每次刷新都会写；没有家庭时会删掉）。
    private var isInFamily: Bool {
        if FamilyChatCoordinator.shared.hasFamily { return true }
        let saved = UserDefaults.standard.string(forKey: FamilyShareTarget.selectedGroupIdKey) ?? ""
        return !saved.isEmpty
    }

    /// 冷启动 / 回到前台时调用。幂等：同一份剪贴板内容只读一次。
    func checkIfNeeded() {
        let pb = UIPasteboard.general
        guard detectedCode == nil else { return }
        let first = UserDefaults.standard.double(forKey: firstLaunchKey)
        guard first > 0, Date().timeIntervalSince1970 - first < Self.checkWindow else { return }
        guard !isInFamily else { return }
        // 登录页在前台时（如用户刚从邮件复制了验证码回来）不检测：弹框会挂在被盖住的主界面上
        guard !AppRouter.shared.isShowingLogin else { return }
        guard pb.hasStrings else { return }
        let cc = pb.changeCount
        guard cc != readChangeCount,
              cc != UserDefaults.standard.integer(forKey: lastCheckedKey) else { return }
        UserDefaults.standard.set(cc, forKey: lastCheckedKey)

        let text = pb.string // 这里系统会弹「允许粘贴」
        readChangeCount = cc
        readText = text
        if let text, let code = Self.extractInviteCode(from: text) {
            detectedChangeCount = cc
            detectedCode = code
        }
    }

    /// 首页剪贴板检测用：剪贴板就是刚读过的那份 → 返回已读内容（nil 表示没读过，需自行读取）
    func cachedText() -> String? {
        UIPasteboard.general.changeCount == readChangeCount ? readText : nil
    }

    /// 当前剪贴板是否就是检测到的邀请（首页检测据此跳过，避免连弹两个框）
    var clipboardIsDetectedInvite: Bool {
        detectedChangeCount != nil && UIPasteboard.general.changeCount == detectedChangeCount
    }

    /// 用户点了加入或取消：清空剪贴板（仅当仍是那份邀请内容），并结束本次检测
    func finish() {
        let pb = UIPasteboard.general
        if let cc = detectedChangeCount, pb.changeCount == cc {
            pb.items = []
            UserDefaults.standard.set(pb.changeCount, forKey: lastCheckedKey)
        }
        detectedChangeCount = nil
        detectedCode = nil
    }

    // MARK: - 识别

    /// 邀请码字母表与服务端 randomInviteCode 一致（BASE32 去掉 0 O 1 I）
    private static let codeChars = "[A-HJ-NP-Z2-9]{6}"

    /// 识别两种内容：
    ///   1. 含我们邀请链接的文本：starlensai.com/i?code=XXXXXX 或 /i/XXXXXX（兼容旧域名 starlens.ai）
    ///   2. 整段文本就是一个 6 位邀请码（只认大写，降低误判普通单词的概率）。
    ///      必须含至少一个字母：邮箱登录验证码是 6 位纯数字，不含 0/1 的约 26% 会落在邀请码字母表里，
    ///      不排除就会把验证码当成邀请码弹框、还把用户刚复制的验证码清掉。纯数字邀请码概率 (8/32)^6 ≈ 0.02%，可忽略。
    static func extractInviteCode(from text: String) -> String? {
        let linkPattern = #"starlens(?:ai\.com|\.ai)/i(?:/|\?(?:[^\s]*&)?code=)([A-Za-z0-9]{6})(?![A-Za-z0-9])"#
        if let re = try? NSRegularExpression(pattern: linkPattern, options: [.caseInsensitive]),
           let m = re.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
           let r = Range(m.range(at: 1), in: text) {
            let code = text[r].uppercased()
            if code.range(of: "^\(codeChars)$", options: .regularExpression) != nil { return code }
        }
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.range(of: "^\(codeChars)$", options: .regularExpression) != nil,
           trimmed.rangeOfCharacter(from: .letters) != nil { return trimmed }
        return nil
    }
}
