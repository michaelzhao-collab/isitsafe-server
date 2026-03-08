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
    }
}
