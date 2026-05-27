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
    public func syncFromServer(_ serverValue: Bool?) {
        guard let value = serverValue else { return }
        if isEnabled != value {
            isEnabled = value
            UserDefaults.standard.set(value, forKey: Self.localKey)
        }
    }

    /// 本地切换 + 上报服务端
    public func toggle(enabled: Bool) async {
        // 乐观更新：立即生效
        isEnabled = enabled
        UserDefaults.standard.set(enabled, forKey: Self.localKey)

        // 上报服务端（失败保留本地状态，下次登录会从服务端覆盖）
        struct ToggleRequest: Encodable { let enabled: Bool }
        struct ToggleResponse: Decodable { let success: Bool; let enabled: Bool }
        do {
            let _: ToggleResponse = try await NetworkManager.shared.request(
                endpoint: .v3UserElderMode,
                body: ToggleRequest(enabled: enabled)
            )
        } catch {
            #if DEBUG
            print("[ElderMode] server toggle failed: \(error)")
            #endif
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
