//
//  ShareViewController.swift
//  StarLensShareExtension
//
//  V3-A1 Share Extension：接收微信/iMessage/Telegram 分享的音频文件
//  流程：
//   1. 用户长按对方语音 → 系统分享面板 → StarLens
//   2. 本 Extension 接收附件 → 拷贝到 App Group 共享目录
//   3. 在 App Group 写一个 pending 标记
//   4. 关闭 Extension（用户回到主 App 后会自动跳深伪检测）
//
//  Xcode 接入步骤（必须做）：
//   1) 在 Xcode 主 project 中 File → New → Target → Share Extension
//      产品名：StarLensShareExtension，与本文件夹一致
//   2) 把本 swift 文件加入到 target source
//   3) 配置 Info.plist NSExtensionActivationRule：
//      NSExtensionActivationSupportsFileWithMaxCount = 1
//      NSExtensionActivationSupportsAttachmentsWithMaxCount = 1
//      NSExtensionActivationUsesStrictMatching = NO
//   4) 在两个 target（主 App + Extension）都开启 App Groups capability
//      groupId 用：group.com.starlens.IsItSafe.share
//   5) 主 App 在 onAppear 检测 pending → 自动跳深伪检测页（详见主 App AppLifecycle）
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
                if attachment.hasItemConformingToTypeIdentifier(UTType.audio.identifier) {
                    attachment.loadDataRepresentation(forTypeIdentifier: UTType.audio.identifier) { [weak self] data, _ in
                        self?.handleAudioData(data)
                    }
                    return
                }
                if attachment.hasItemConformingToTypeIdentifier(UTType.movie.identifier) {
                    // 视频也允许（用户可能从微信发的视频分享）— 二期支持视频深伪
                    attachment.loadDataRepresentation(forTypeIdentifier: UTType.movie.identifier) { [weak self] data, _ in
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

    private func completeAndDismiss(success: Bool) {
        if success {
            // 提示用户：返回 StarLens 主 App 即可继续
            let alert = UIAlertController(
                title: "已收到",
                message: "请打开 StarLens 主 App 继续语音深伪检测",
                preferredStyle: .alert
            )
            alert.addAction(UIAlertAction(title: "好", style: .default) { _ in
                self.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
            })
            present(alert, animated: true)
        } else {
            extensionContext?.cancelRequest(withError: NSError(
                domain: "StarLensShareExtension",
                code: -1,
                userInfo: [NSLocalizedDescriptionKey: "无法读取音频"]
            ))
        }
    }
}
