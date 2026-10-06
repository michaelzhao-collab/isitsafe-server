//
//  ElderModeService.swift
//  IsItSafe
//
//  V3-J 长辈模式开关管理 + 持久化
//
//  优先级：服务端 user.elder_mode_enabled > 本地 UserDefaults
//  服务端用于：监护人远程开启 + 多设备同步
//  本地用于：未登录/服务端不可用时回退
//

import Foundation
import Combine

@MainActor
public final class ElderModeService: ObservableObject {
    public static let shared = ElderModeService()

    @Published public private(set) var isEnabled: Bool = false

    private static let localKey = "isitsafe.elderModeEnabled"

    private init() {
        // 启动时先用本地缓存，避免闪烁
        isEnabled = UserDefaults.standard.bool(forKey: Self.localKey)
    }

    /// 从服务端 user 同步状态（登录后调用）
    /// 2026-09-27 复核：nil（服务端未开或字段缺失）视为 false —— 否则会继承上一个账号
    /// 在本机留下的本地开关，子女在父母手机登录会得到长辈界面。
    public func syncFromServer(_ serverValue: Bool?) {
        // 用户正在切换（请求未回）时不让旧数据把开关拨回去
        guard inFlight == 0 else { return }
        let value = serverValue ?? false
        // 已上报成功但缓存还没刷新成新值（重拉 userinfo 失败）：在看到一致的值之前忽略旧值
        if let expected = expectedServerValue {
            guard value == expected else { return }
            expectedServerValue = nil
        }
        if isEnabled != value {
            isEnabled = value
            UserDefaults.standard.set(value, forKey: Self.localKey)
        }
    }

    /// 换账号/登出时清除设备级长辈模式状态（2026-09-27 复核）
    public func reset() {
        isEnabled = false
        UserDefaults.standard.set(false, forKey: Self.localKey)
    }

    /// 进行中的切换请求数；generation 标记最近一次切换，只有它负责回退
    private var inFlight = 0
    private var generation = 0
    /// 服务端已确认的目标值，等缓存同步到这个值之前不接受旧值
    private var expectedServerValue: Bool?

    /// 本地切换 + 上报服务端
    ///
    /// 2026-10-06：长辈模式「点了不生效」。AppStateViewModel.refreshLoginState() 用本地缓存的 user
    /// （登录时存的，elder_mode_enabled 还是旧值）调 syncFromServer，而它在进「我的」/设置页、回前台时都会触发 →
    /// 刚打开就被旧缓存拨回关闭。现在：请求期间忽略同步；成功后重拉 userinfo 让缓存变成新值；
    /// 失败则回退（否则界面显示已开、实际下一次同步又被关掉）。
    public func toggle(enabled: Bool) async {
        let previous = isEnabled
        // 乐观更新：立即生效
        isEnabled = enabled
        UserDefaults.standard.set(enabled, forKey: Self.localKey)
        // 未登录：只有本地状态，无需上报
        guard AuthInterceptor.token() != nil else { return }

        generation += 1
        let myGeneration = generation
        inFlight += 1
        defer { inFlight -= 1 }
        struct ToggleRequest: Encodable { let enabled: Bool }
        struct ToggleResponse: Decodable { let success: Bool; let enabled: Bool }
        do {
            let _: ToggleResponse = try await NetworkManager.shared.request(
                endpoint: .v3UserElderMode,
                body: ToggleRequest(enabled: enabled)
            )
            expectedServerValue = enabled
            _ = try? await AuthService.shared.fetchUserInfo()
        } catch {
            // 期间用户又切了一次：以最新那次为准，这次失败不回退、不提示
            guard myGeneration == generation else { return }
            #if DEBUG
            print("[ElderMode] server toggle failed: \(error)")
            #endif
            isEnabled = previous
            UserDefaults.standard.set(previous, forKey: Self.localKey)
            let en = AppSettingsStore.shared.languageCode == "en"
            AppStateViewModel.shared.showError(en ? "Couldn't switch Elder Mode. Please try again." : "长辈模式切换失败，请稍后重试")
        }
    }

    /// 监护人远程开启被监护人长辈模式
    public func remoteToggleForMember(targetUserId: String, enabled: Bool) async -> Bool {
        struct Body: Encodable { let enabled: Bool }
        struct Resp: Decodable { let success: Bool? }
        do {
            // 自定义直接 POST（APIEndpoint 已有 v3FamilyRemoveMember 类似形态可参考；这里复用 PUT
            // /api/v3/family/members/:userId/elder-mode 这条 W6 stub 路由）
            // 为避免在 endpoint enum 中增加新 case，借助直接构造 URL 的能力可后续优化
            // 一期：用通用 PUT 接口直接打到该路径
            return try await directPut(
                path: "/api/v3/family/members/\(targetUserId)/elder-mode",
                body: Body(enabled: enabled)
            )
        } catch {
            #if DEBUG
            print("[ElderMode] remote toggle failed: \(error)")
            #endif
            return false
        }
    }

    private func directPut<B: Encodable>(path: String, body: B) async throws -> Bool {
        var urlString = AppConfiguration.shared.baseURL
        if urlString.hasSuffix("/") { urlString = String(urlString.dropLast()) }
        urlString += path
        guard let url = URL(string: urlString) else { return false }
        var req = URLRequest(url: url)
        req.httpMethod = "PUT"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = AuthInterceptor.token() {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        req.httpBody = try JSONEncoder().encode(body)
        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            return false
        }
        // 成功后服务端返回的 success 字段（一期 stub 可能是 NOT_IMPLEMENTED）
        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let success = json["success"] as? Bool {
            return success
        }
        return true
    }
}
