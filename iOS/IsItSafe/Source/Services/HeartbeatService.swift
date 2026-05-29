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
//  S2-1：trigger_source 区分启动来源
//   - cold_launch：冷启动（App 进程启动）
//   - foreground：从后台回到前台
//   - universal_link：Universal Link 打开 App
//   - share_extension：Share Extension 唤起主 App
//   仅 push tap 后用户无后续动作不应算活跃 —— 因此 iOS 不主动传 push_tap；
//   push 唤起后若用户停留就会触发 foreground，自然走 foreground。
//

import Foundation

public final class HeartbeatService {
    public static let shared = HeartbeatService()

    public enum TriggerSource: String {
        case coldLaunch = "cold_launch"
        case foreground = "foreground"
        case universalLink = "universal_link"
        case shareExtension = "share_extension"
    }

    /// 节流窗口：5 分钟内重复触发只算一次
    private let throttleInterval: TimeInterval = 300
    private var lastReportedAt: Date?
    private let queue = DispatchQueue(label: "isitsafe.heartbeat", qos: .utility)

    private init() {}

    /// 上报活跃。
    /// 未登录用户直接 no-op（关怀机制依赖账号体系）。
    public func reportActive(trigger: TriggerSource = .foreground) async {
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

        struct HeartbeatReq: Codable {
            let trigger_source: String
        }
        struct Response: Decodable {
            let active: Bool
            let todayCount: Int
            let triggerSources: [String]?

            enum CodingKeys: String, CodingKey {
                case active
                case todayCount = "today_count"
                case triggerSources = "trigger_sources"
            }
        }

        do {
            let _: Response = try await NetworkManager.shared.request(
                endpoint: .v3UserHeartbeat,
                body: HeartbeatReq(trigger_source: trigger.rawValue)
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
