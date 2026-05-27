//
//  ShareViewController.swift
//  StarLensShareExtension
//
//  V3-A1 Share Extension：接收微信/iMessage 分享的音频文件
//  仅接收 audio 类型；视频/图片不接受（避免主 App 当音频上传失败）
//  流程：
//   1. 用户长按对方语音 → 系统分享面板 → StarLens
//   2. 本 Extension 接收音频附件 → 拷贝到 App Group 共享目录
//   3. 在 App Group 写一个 pending 标记
//   4. 立即关闭 Extension（用户回到主 App 后会自动跳深伪检测）
//
//  Xcode 接入步骤：
//   1) File → New → Target → Share Extension，命名 StarLensShareExtension
//   2) 删除自动生成的 Storyboard 和默认 ShareViewController，把本文件加入 target
//   3) 主 App + Extension 都开启 App Groups capability，group ID:
//      group.com.starlens.IsItSafe.share
//   4) 主 App 在 onAppear 检测 pending → 自动跳深伪检测页
//

import UIKit
import UniformTypeIdentifiers

private let appGroupId = "group.com.starlens.IsItSafe.share"
private let pendingFlagKey = "pendingDeepfakeAudio"

final class ShareViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        showLoading()
        handleSharedItem()
    }

    private func showLoading() {
        let label = UILabel()
        label.text = "正在接收语音..."
        label.font = .systemFont(ofSize: 16, weight: .medium)
        label.textColor = .secondaryLabel
        label.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(label)
        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            label.centerYAnchor.constraint(equalTo: view.centerYAnchor),
        ])
    }

    private func handleSharedItem() {
        guard let items = extensionContext?.inputItems as? [NSExtensionItem] else {
            completeAndDismiss(success: false)
            return
        }
        for item in items {
            guard let attachments = item.attachments else { continue }
            for attachment in attachments {
                // 一期仅接受音频；视频/图片不处理（避免主 App 当音频上传时 magic byte 校验失败）
                if attachment.hasItemConformingToTypeIdentifier(UTType.audio.identifier) {
                    attachment.loadDataRepresentation(forTypeIdentifier: UTType.audio.identifier) { [weak self] data, _ in
                        self?.handleAudioData(data)
                    }
                    return
                }
            }
        }
        completeAndDismiss(success: false)
    }

    private func handleAudioData(_ data: Data?) {
        guard let data = data,
              let containerURL = FileManager.default
                .containerURL(forSecurityApplicationGroupIdentifier: appGroupId)
        else {
            DispatchQueue.main.async { self.completeAndDismiss(success: false) }
            return
        }

        let dir = containerURL.appendingPathComponent("DeepfakeInbox", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        // 顺手清理 24h 以上的孤立文件，避免目录无限增长
        cleanupStaleFiles(in: dir)

        let fileURL = dir.appendingPathComponent("shared_\(UUID().uuidString).m4a")
        do {
            try data.write(to: fileURL, options: .atomic)
            // 写 pending 标记到 App Group UserDefaults
            let defaults = UserDefaults(suiteName: appGroupId)
            defaults?.set(fileURL.lastPathComponent, forKey: pendingFlagKey)
            defaults?.set(Date().timeIntervalSince1970, forKey: "\(pendingFlagKey).at")
            defaults?.synchronize()

            DispatchQueue.main.async { self.completeAndDismiss(success: true) }
        } catch {
            DispatchQueue.main.async { self.completeAndDismiss(success: false) }
        }
    }

    /// 删除目录中超过 24h 的孤立文件
    private func cleanupStaleFiles(in dir: URL) {
        let fm = FileManager.default
        guard let items = try? fm.contentsOfDirectory(at: dir, includingPropertiesForKeys: [.creationDateKey]) else { return }
        let cutoff = Date().addingTimeInterval(-24 * 3600)
        for url in items {
            if let attrs = try? fm.attributesOfItem(atPath: url.path),
               let createdAt = attrs[.creationDate] as? Date,
               createdAt < cutoff {
                try? fm.removeItem(at: url)
            }
        }
    }

    private func completeAndDismiss(success: Bool) {
        if success {
            // 立即关闭 Extension，符合 Share Extension UX 规范
            // 主 App 启动时会检测 pending 标记并自动跳深伪检测
            extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
        } else {
            extensionContext?.cancelRequest(withError: NSError(
                domain: "StarLensShareExtension",
                code: -1,
                userInfo: [NSLocalizedDescriptionKey: "无法读取音频（仅支持音频文件）"]
            ))
        }
    }
}
