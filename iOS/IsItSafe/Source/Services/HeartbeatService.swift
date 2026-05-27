//
//  HeartbeatService.swift
//  IsItSafe
//
//  V3-E 心跳上报（关怀机制核心依赖）
//
//  调用时机：用户**真实主动打开 App**（冷启 + foreground）→ 上报一次
//  节流：5 分钟内多次 active 只算一次（避免高频写服务端）
//  失败处理：失败保留 lastReportedAt 不更新，下次仍会重试
//

import Foundation

public final class HeartbeatService {
    public static let shared = HeartbeatService()

    /// 节流窗口：5 分钟内重复触发只算一次
    private let throttleInterval: TimeInterval = 300
    private var lastReportedAt: Date?
    private let queue = DispatchQueue(label: "isitsafe.heartbeat", qos: .utility)

    private init() {}

    /// 上报活跃。
    /// 未登录用户直接 no-op（关怀机制依赖账号体系）。
    public func reportActive() async {
        // 节流
        let shouldReport: Bool = await withCheckedContinuation { cont in
            queue.async {
                if let last = self.lastReportedAt, Date().timeIntervalSince(last) < self.throttleInterval {
                    cont.resume(returning: false)
                } else {
                    cont.resume(returning: true)
                }
            }
        }
        guard shouldReport else { return }

        // 仅已登录用户上报
        guard AuthInterceptor.token() != nil else { return }

        struct Empty: Codable {}
        struct Response: Decodable {
            let active: Bool
            let todayCount: Int

            enum CodingKeys: String, CodingKey {
                case active
                case todayCount = "today_count"
            }
        }

        do {
            // 服务端期望 POST，无 body
            let _: Response = try await NetworkManager.shared.request(
                endpoint: .v3UserHeartbeat,
                body: Empty()
            )
            queue.async { self.lastReportedAt = Date() }
        } catch {
            // 静默失败：网络问题不影响用户使用，下次主动打开会自动重试
            #if DEBUG
            print("[Heartbeat] report failed: \(error)")
            #endif
        }
    }

    /// 强制重置节流（用于登录后立即触发一次）
    public func resetThrottle() {
        queue.async { self.lastReportedAt = nil }
    }
}
