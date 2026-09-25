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
    }
}
