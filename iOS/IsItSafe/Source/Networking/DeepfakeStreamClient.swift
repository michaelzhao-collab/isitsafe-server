//
//  DeepfakeStreamClient.swift
//  IsItSafe
//
//  V3-A1 S2-5：Server-Sent Events 客户端
//
//  PRD 列了 "WS /ws/deepfake"；本仓库无 socket.io 依赖，改用 SSE：
//   - Server: NestJS @Sse() 端点 /api/v3/deepfake/voice/:taskId/stream
//   - 客户端：URLSession 字节流读取，按 "data: <json>\n\n" 协议解析
//   - 失败 / 超时：调用方应 fallback 到 GET /voice/:taskId 兜底
//
//  对外接口：
//   try await DeepfakeStreamClient.shared.stream(taskId: id) { check in ... }
//   close: stream 在 done/failed/timeout/网络断开 时自然返回
//

import Foundation

public final class DeepfakeStreamClient {
    public static let shared = DeepfakeStreamClient()
    private init() {}

    public enum StreamError: Error {
        case notAuthenticated
        case httpStatus(Int)
        case invalidEvent
    }

    /// 订阅 SSE 流。每收到一帧 `data:` 行就回调一次解码后的 DeepfakeCheck。
    /// 流自然结束（服务端 complete）或抛错时 stream(...) 才返回。
    public func stream(
        taskId: String,
        onEvent: @escaping (DeepfakeCheck) -> Void
    ) async throws {
        guard let token = AuthInterceptor.token() else { throw StreamError.notAuthenticated }

        let base = AppConfiguration.shared.baseURL
        let path = APIEndpoint.v3DeepfakeStream(taskId: taskId).path
        guard let url = URL(string: base + path) else { throw StreamError.invalidEvent }

        var req = URLRequest(url: url)
        req.httpMethod = "GET"
        req.setValue("text/event-stream", forHTTPHeaderField: "Accept")
        req.setValue("no-cache", forHTTPHeaderField: "Cache-Control")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.timeoutInterval = 90 // server SSE 60s + 30s buffer

        let (bytes, response) = try await URLSession.shared.bytes(for: req)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            let code = (response as? HTTPURLResponse)?.statusCode ?? 0
            throw StreamError.httpStatus(code)
        }

        // 解析 "data: <json>\n\n"：一次累积一个事件，遇空行就 flush
        var dataBuffer = ""
        for try await line in bytes.lines {
            if line.isEmpty {
                // 事件结束
                if !dataBuffer.isEmpty {
                    if let payload = dataBuffer.data(using: .utf8),
                       let check = try? JSONDecoder().decode(DeepfakeCheck.self, from: payload) {
                        onEvent(check)
                    }
                    dataBuffer = ""
                }
                continue
            }
            if line.hasPrefix("data:") {
                let val = line.dropFirst("data:".count).trimmingCharacters(in: .whitespaces)
                if !val.isEmpty {
                    if !dataBuffer.isEmpty { dataBuffer += "\n" }
                    dataBuffer += val
                }
            }
            // 其他控制行（event:/id:/retry:）一期忽略
        }
        // 流自然 EOF：最后再 flush 一次（兼容服务端无尾部空行的实现）
        if !dataBuffer.isEmpty,
           let payload = dataBuffer.data(using: .utf8),
           let check = try? JSONDecoder().decode(DeepfakeCheck.self, from: payload) {
            onEvent(check)
        }
    }
}
