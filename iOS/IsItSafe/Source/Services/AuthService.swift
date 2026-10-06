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

    /// 统一登录：手机号+密码，或邮箱+验证码（code）。
    /// 两条路径共用同一个端点和同一套 token 落地副作用，新增 code 参数带默认值，现有调用点不受影响。
    public func login(phone: String?, email: String?, password: String?, code: String? = nil) async throws {
        let req = LoginRequest(phone: phone, email: email, password: password, code: code)
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

    /// 邮箱验证码登录。复用 login() 的 token 落地流程（写 TokenStore → 拉 userinfo →
    /// 重置本地免费次数 → 重新上报 push token），避免另起一套导致漏掉副作用。
    public func loginWithEmailCode(email: String, code: String) async throws {
        try await login(phone: nil, email: email, password: nil, code: code)
    }

    /// 发送邮箱验证码。
    ///
    /// 这里不走 NetworkManager.request：通用链路的 ResponseValidator 会把 429 压成
    /// APIError.tooManyRequests，丢掉服务端返回的 retryAfterSeconds（倒计时要用），
    /// 而且它在 401 时会顺手清 session —— 对一个未登录接口是多余副作用。
    /// 请求仍由 RequestBuilder 构造，保证 baseURL / 超时 / X-App-Language / X-App-Version 等头一致。
    public func sendEmailCode(email: String, language: String? = nil) async throws -> SendEmailCodeResponse {
        let lang = language ?? (AppSettingsStore.shared.languageCode == "en" ? "en" : "zh")
        let body = SendEmailCodeRequest(email: email, language: lang)
        let request = try RequestBuilder.build(
            endpoint: .authSendEmailCode,
            baseURL: AppConfiguration.shared.baseURL,
            body: body,
            authToken: nil
        )
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError.unknown("无效响应") }
        let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]

        if http.statusCode == 429 {
            let retry = (json?["retryAfterSeconds"] as? Int) ?? 60
            throw EmailCodeRateLimited(retryAfterSeconds: retry, message: messageText(from: json))
        }
        guard (200...299).contains(http.statusCode) else {
            throw APIError.serverError(statusCode: http.statusCode, message: messageText(from: json))
        }
        // 解码失败不阻断流程：只要是 2xx 就按"已发送"处理，冷却/有效期回退到默认值
        return (try? JSONDecoder().decode(SendEmailCodeResponse.self, from: data))
            ?? SendEmailCodeResponse(success: true)
    }

    /// NestJS 的 message 既可能是字符串，也可能是校验错误数组
    private func messageText(from json: [String: Any]?) -> String? {
        if let m = json?["message"] as? String { return m }
        if let arr = json?["message"] as? [String] { return arr.first }
        return nil
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
        // 2026-09-27 复核：先取本机推送 token 随登出请求解绑，再清本地缓存（顺序不能反）
        let deviceToken = PushService.shared.currentDeviceToken
        _ = try? await repo.logout(deviceToken: deviceToken)
        sessionStore.clearSession()
        AppSettingsStore.shared.resetFreeQueryCount()
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
            // 2026-09-27 复核：原来任何 error（含网络超时/离线）都清 session → 用户被无故登出。
            // 只有服务端明确判定 refresh token 失效（401）才清；网络类错误保留登录态，下次重试。
            if case APIError.unauthorized = error {
                sessionStore.clearSession()
            }
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

        // 2026-09-27 复核：原来「读 inFlightRefresh → 判 nil → 写」分两次 MainActor.run，
        // 中间可被抢占 → 两个并发调用都看到 nil → 各起一个刷新任务 → 第二个用已轮换的
        // refresh token 必 401 → clearSession 把用户登出。现在 get-or-create 原子完成。
        let task = getOrCreateRefreshTask()
        await task.value
        if inFlightRefresh == task { inFlightRefresh = nil }
    }

    /// 原子地取得或创建刷新任务：在同一个 MainActor 调用内完成读+判+写
    @MainActor
    private func getOrCreateRefreshTask() -> Task<Void, Never> {
        if let existing = inFlightRefresh { return existing }
        let task = Task<Void, Never> { [weak self] in await self?.refreshTokenIfNeeded() }
        inFlightRefresh = task
        return task
    }
}
