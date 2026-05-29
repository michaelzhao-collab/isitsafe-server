//
//  PushService.swift
//  IsItSafe
//
//  V3-S1-5 推送注册（APNs device token 上报）
//
//  生命周期：
//   1. App 启动后异步请求通知权限（用户首次允许时才会触发 didRegisterForRemoteNotifications）
//   2. AppDelegate 拿到 deviceToken → 转给 PushService → POST /api/user/v3/devices
//   3. token 失败/变化 → didFailToRegisterForRemoteNotificationsWithError 或下次启动重注册
//   4. 登录态切换：登出后清掉 lastRegisteredToken；下次登录会重新上报（owner 归属迁移）
//
//  约定：未登录用户不上报（服务端 endpoint 需 JWT，强行调用只会 401）
//

import Foundation
import UIKit
import UserNotifications

public final class PushService {
    public static let shared = PushService()

    private let storage = UserDefaults.standard
    private let lastTokenKey = "isitsafe.push.lastRegisteredToken"
    private let lastUserIdKey = "isitsafe.push.lastUserId"

    /// 当前进程内已上报过的 token（避免重复 POST）
    private var inFlightToken: String?
    private let queue = DispatchQueue(label: "isitsafe.push", qos: .utility)

    private init() {}

    /// App 启动后调用，向系统申请通知权限。
    /// 用户允许后系统自动触发 didRegisterForRemoteNotificationsWithDeviceToken，
    /// 由 AppDelegate 转给 didReceiveDeviceToken(_:)。
    public func requestAuthorizationAndRegister() {
        UNUserNotificationCenter.current().requestAuthorization(
            options: [.alert, .sound, .badge]
        ) { granted, error in
            if let error = error {
                #if DEBUG
                print("[Push] requestAuthorization error: \(error.localizedDescription)")
                #endif
                return
            }
            guard granted else {
                #if DEBUG
                print("[Push] notification not granted")
                #endif
                return
            }
            DispatchQueue.main.async {
                UIApplication.shared.registerForRemoteNotifications()
            }
        }
    }

    /// AppDelegate didRegisterForRemoteNotificationsWithDeviceToken 转入
    public func didReceiveDeviceToken(_ rawToken: Data) {
        let hex = rawToken.map { String(format: "%02x", $0) }.joined()
        Task { await self.sendToBackendIfNeeded(token: hex) }
    }

    /// AppDelegate didFailToRegisterForRemoteNotificationsWithError 转入
    public func didFailToRegister(error: Error) {
        #if DEBUG
        print("[Push] registerForRemoteNotifications failed: \(error.localizedDescription)")
        #endif
    }

    /// 登出时清理本地状态，下次登录会重新上报
    public func clearOnLogout() {
        queue.async {
            self.inFlightToken = nil
            self.storage.removeObject(forKey: self.lastTokenKey)
            self.storage.removeObject(forKey: self.lastUserIdKey)
        }
    }

    /// 登录后主动重传 token（恢复购买/换号场景下，token 没变但 owner 变了）
    public func reregisterIfTokenCached() {
        guard let token = storage.string(forKey: lastTokenKey), !token.isEmpty else { return }
        Task { await sendToBackendIfNeeded(token: token, force: true) }
    }

    // MARK: - private

    /// 上报 token，去重 + 去抖。
    /// - force=true：忽略 lastRegisteredToken 缓存（用于登录后强制重传）
    private func sendToBackendIfNeeded(token: String, force: Bool = false) async {
        guard AuthInterceptor.token() != nil else {
            // 未登录：先暂存，等登录后 reregisterIfTokenCached 触发上报
            storage.set(token, forKey: lastTokenKey)
            return
        }
        // 同一 token 已成功上报过则跳过（除非 force）
        if !force,
           let last = storage.string(forKey: lastTokenKey),
           last == token {
            return
        }
        // 同一 token 当前正在飞中，避免重复发
        let isInFlight: Bool = await withCheckedContinuation { cont in
            queue.async {
                if self.inFlightToken == token {
                    cont.resume(returning: true)
                } else {
                    self.inFlightToken = token
                    cont.resume(returning: false)
                }
            }
        }
        if isInFlight { return }

        struct RegisterReq: Codable {
            let deviceToken: String
            let platform: String
            let environment: String
            let appVersion: String?
            let locale: String?

            enum CodingKeys: String, CodingKey {
                case deviceToken = "deviceToken"
                case platform
                case environment
                case appVersion = "appVersion"
                case locale
            }
        }
        struct Resp: Decodable { let success: Bool }

        #if DEBUG
        let env = "sandbox"
        #else
        let env = "production"
        #endif
        let appVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String
        let locale = Locale.current.identifier

        let req = RegisterReq(
            deviceToken: token,
            platform: "ios",
            environment: env,
            appVersion: appVersion,
            locale: locale
        )
        do {
            let _: Resp = try await NetworkManager.shared.request(
                endpoint: .v3UserRegisterDevice,
                body: req
            )
            queue.async { self.inFlightToken = nil }
            storage.set(token, forKey: lastTokenKey)
        } catch {
            queue.async { self.inFlightToken = nil }
            #if DEBUG
            print("[Push] register backend failed: \(error)")
            #endif
        }
    }
}
