//
//  PushAppDelegate.swift
//  IsItSafe
//
//  V3-S1-5：SwiftUI 应用入口注入 UIApplicationDelegateAdaptor，
//  专门承接 APNs 注册回调（didRegister / didFailToRegister）。
//
//  设计：保持 delegate 职责单一 —— 只转发给 PushService，不做业务。
//

import UIKit
import UserNotifications

public final class PushAppDelegate: NSObject, UIApplicationDelegate {

    public func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        // 让 PushService 决定何时请求权限（避免冷启就弹）
        UNUserNotificationCenter.current().delegate = NotificationCenterForwarder.shared
        return true
    }

    public func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        PushService.shared.didReceiveDeviceToken(deviceToken)
    }

    public func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        PushService.shared.didFailToRegister(error: error)
    }
}

/// 前台收到 push 时仍展示，避免静默吞掉 — 业务侧（如家庭广播 / 关怀提醒）
/// 在前台也希望用户能看到。后续 S2 可以加 routing。
public final class NotificationCenterForwarder: NSObject, UNUserNotificationCenterDelegate {
    public static let shared = NotificationCenterForwarder()
    private override init() {}

    public func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound, .badge])
    }
}
