//
//  AuthService.swift
//  IsItSafe
//

import Foundation

public final class AuthService {
    public static let shared = AuthService()
    private let repo = AuthRepository.shared
    private let tokenStore = TokenStore.shared
    private let sessionStore = UserSessionStore.shared

    private init() {}

    public func login(phone: String?, email: String?, code: String?, smsCode: String?) async throws {
        let req = LoginRequest(phone: phone, email: email, code: code, smsCode: smsCode)
        let res = try await repo.login(req)
        tokenStore.saveToken(access: res.accessToken, refresh: res.refreshToken)
        let user = try await repo.userInfo()
        sessionStore.updateUser(user)
    }

    public func logout() async throws {
        _ = try? await repo.logout()
        sessionStore.clearSession()
    }

    public func fetchUserInfo() async throws -> UserInfoResponse {
        let user = try await repo.userInfo()
        sessionStore.updateUser(user)
        return user
    }

    /// 上传头像到 OSS，返回 CDN URL
    public func uploadAvatar(imageData: Data, filename: String = "avatar.jpg") async throws -> String {
        try await repo.uploadAvatar(imageData: imageData, filename: filename)
    }

    /// 更新用户资料；成功后刷新本地 user
    public func updateProfile(avatar: String? = nil, nickname: String? = nil, gender: String? = nil, birthday: String? = nil) async throws {
        try await repo.updateProfile(avatar: avatar, nickname: nickname, gender: gender, birthday: birthday)
        _ = try await fetchUserInfo()
    }

    public var isLoggedIn: Bool { sessionStore.isLoggedIn }
    public var currentUser: UserInfoResponse? { sessionStore.currentUser }

    public func refreshTokenIfNeeded() async {
        guard let refresh = tokenStore.refreshToken else { return }
        do {
            let res = try await repo.refreshToken(refreshToken: refresh)
            tokenStore.saveToken(access: res.accessToken, refresh: res.refreshToken)
            _ = try await repo.userInfo()
        } catch {
            sessionStore.clearSession()
        }
    }
}
