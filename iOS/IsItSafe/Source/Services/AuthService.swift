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

    public func login(phone: String?, email: String?, password: String?) async throws {
        let req = LoginRequest(phone: phone, email: email, password: password)
        let res = try await repo.login(req)
        tokenStore.saveToken(access: res.accessToken, refresh: res.refreshToken)
        let user = try await repo.userInfo()
        sessionStore.updateUser(user)
        // 登入新用户：清掉上个用户的本地免费次数计数（没按 userId 隔离，会串号）
        AppSettingsStore.shared.resetFreeQueryCount()
        // LocalDefaultQAStore 已经按 userId 隔离，登入不需要清；
        // 新用户的 userId 对应文件不存在 → shouldShowDefaultQA 自然返回 true
        PushService.shared.reregisterIfTokenCached()
    }

    public func loginWithApple(identityToken: String, appleUser: String?, displayName: String?) async throws {
        let req = AppleLoginRequest(identityToken: identityToken, appleUser: appleUser, displayName: displayName)
        let res = try await repo.appleLogin(req)
        tokenStore.saveToken(access: res.accessToken, refresh: res.refreshToken)
        let user = try await repo.userInfo()
        sessionStore.updateUser(user)
        AppSettingsStore.shared.resetFreeQueryCount()
        PushService.shared.reregisterIfTokenCached()
    }

    public func logout() async throws {
        _ = try? await repo.logout()
        sessionStore.clearSession()
        AppSettingsStore.shared.resetFreeQueryCount()
        // V3-S1-5：登出清理 push 缓存，下次登录会重新上报
        PushService.shared.clearOnLogout()
    }

    public func deleteAccount() async throws {
        // 必须服务端先删成功，再删本地文件
        // 否则 server 调用失败时本地已删 → 用户再登入会重新看到默认对话，状态串乱
        _ = try await repo.deleteAccount()
        LocalDefaultQAStore.shared.deleteForCurrentUser()
        sessionStore.clearSession()
        AppSettingsStore.shared.resetFreeQueryCount()
        PushService.shared.clearOnLogout()
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

    /// 主动刷新阈值：accessToken 距离过期 ≤ 此秒数时触发刷新（提前于 401）
    /// 30s 留出网络 + 服务端时钟漂移余量
    private static let proactiveRefreshThreshold: TimeInterval = 30

    /// 多个并发请求同时触发刷新时共享同一个 Task，避免重复消耗 refreshToken
    @MainActor private var inFlightRefresh: Task<Void, Never>?

    /// NetworkManager 在每次请求前调用：仅当 access token 即将过期才发起刷新
    /// 无 token / 无 refresh / 没有 exp 字段时一律 no-op，不影响匿名请求
    public func ensureFreshTokenIfNearExpiry() async {
        // 没登录 → 直接 return
        guard tokenStore.accessToken != nil, tokenStore.refreshToken != nil else { return }
        // 没有 exp 字段（旧 token 或非标 JWT） → 不主动刷新，仍走 401 路径兜底
        guard let exp = tokenStore.accessTokenExpiry else { return }
        let secondsLeft = exp.timeIntervalSinceNow
        guard secondsLeft <= Self.proactiveRefreshThreshold else { return }

        // 复用进行中的 refresh，避免并发刷新
        if let existing = await MainActor.run(body: { inFlightRefresh }) {
            await existing.value
            return
        }
        let task = Task<Void, Never> { [weak self] in
            await self?.refreshTokenIfNeeded()
        }
        await MainActor.run { inFlightRefresh = task }
        await task.value
        await MainActor.run { inFlightRefresh = nil }
    }
}
