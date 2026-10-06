//
//  UserSessionStore.swift
//  IsItSafe
//

import Foundation

public final class UserSessionStore {
    public static let shared = UserSessionStore()
    private let userKey = "isitsafe.userSession"

    private init() {}

    public var currentUser: UserInfoResponse? {
        get {
            guard let data = UserDefaults.standard.data(forKey: userKey),
                  let user = try? JSONDecoder().decode(UserInfoResponse.self, from: data) else { return nil }
            return user
        }
        set {
            if let u = newValue, let data = try? JSONEncoder().encode(u) {
                UserDefaults.standard.set(data, forKey: userKey)
            } else {
                UserDefaults.standard.removeObject(forKey: userKey)
            }
        }
    }

    public var isLoggedIn: Bool {
        TokenStore.shared.accessToken != nil
    }

    public func updateUser(_ user: UserInfoResponse) {
        currentUser = user
    }

    public func clearSession() {
        TokenStore.shared.clearToken()
        currentUser = nil
        // 2026-09-07 复核：家庭 IM 的本地库 / WebSocket / 未读角标此前无人清理，
        // 换账号后下一个登录者会看到上一个账号的家庭聊天记录、99+ 未读，
        // 且长连接仍绑着旧 token。这里是登出、删账号、401 被动失效三条路径的公共出口。
        Task { @MainActor in FamilyChatCoordinator.shared.stop() }
        // 2026-09-27 复核：设备级长辈模式换账号不清 → 下一个登录者继承上一账号的长辈界面
        Task { @MainActor in ElderModeService.shared.reset() }
        // 2026-09-27 复核：磁盘 HTTP 缓存（含 groups/me/all 的全体成员手机号）与图片缓存
        // 换账号不清 → 上一账号的隐私数据留在设备。登出/删号一并清空。
        URLCache.shared.removeAllCachedResponses()
        NetworkManager.shared.clearURLCache()
        // 2026-10-06：家庭页「当前选中群」换账号不清 → 下一个账号「发到家庭群」发往不属于自己的群（服务端拒绝、按钮无反应），
        // 剪贴板邀请检测也会把新账号误判为「已在家庭」而跳过。
        UserDefaults.standard.removeObject(forKey: "isitsafe.family.selectedGroupId")
    }
}
