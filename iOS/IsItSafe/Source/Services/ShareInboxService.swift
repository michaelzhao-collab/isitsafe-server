//
//  ShareInboxService.swift
//  IsItSafe
//
//  V3-A1 监听 Share Extension 投递的语音文件
//  Share Extension 把音频写入 App Group 共享目录 + 在 UserDefaults 写 pending 标记
//  主 App 启动/foreground 时检查该标记 → 取出文件 → 跳深伪检测页
//
//  接入步骤（Xcode）：必须先开启两个 target 的 App Groups capability，groupId 一致
//

import Foundation

public final class ShareInboxService {
    public static let shared = ShareInboxService()

    private let appGroupId = "group.com.starlens.IsItSafe.share"
    private let pendingFlagKey = "pendingDeepfakeAudio"

    private init() {}

    /// 检查并取出待处理的分享音频
    /// 返回本地文件 URL（App Group 共享目录中），主 App 拿到后可读取上传
    public func checkPendingAudio() -> URL? {
        guard let defaults = UserDefaults(suiteName: appGroupId) else { return nil }
        guard let filename = defaults.string(forKey: pendingFlagKey), !filename.isEmpty else { return nil }
        guard let container = FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: appGroupId)
        else { return nil }
        let url = container.appendingPathComponent("DeepfakeInbox").appendingPathComponent(filename)
        if FileManager.default.fileExists(atPath: url.path) {
            return url
        }
        // 文件不在 → 清除 stale 标记
        clearPending()
        return nil
    }

    /// 消费后清除 pending 标记 + 删除文件
    public func consume(url: URL) {
        try? FileManager.default.removeItem(at: url)
        clearPending()
    }

    public func clearPending() {
        guard let defaults = UserDefaults(suiteName: appGroupId) else { return }
        defaults.removeObject(forKey: pendingFlagKey)
        defaults.removeObject(forKey: "\(pendingFlagKey).at")
        defaults.synchronize()
    }
}
