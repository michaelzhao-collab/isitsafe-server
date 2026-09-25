//
//  ChatWebSocketClient.swift
//  IsItSafe
//
//  V5.1 自建 IM WebSocket 客户端。连接 /chat，收服务端下行信号。
//
//  角色：只是"加速器"。断线/失败不影响功能——ChatEngine 有前台轮询兜底。
//  职责：token 握手连接 → 收信号回调 → 心跳保活 → 指数退避重连 → 上报连接状态。
//

import Foundation

public final class ChatWebSocketClient: NSObject {
    /// 收到下行信号
    public var onSignal: ((ChatSignal) -> Void)?
    /// 连接状态变化（true=已连接）。断→连时协调器应触发全量 resync 补齐断连期间的消息。
    public var onConnectedChange: ((Bool) -> Void)?

    private var task: URLSessionWebSocketTask?
    private lazy var session: URLSession = {
        let cfg = URLSessionConfiguration.default
        cfg.waitsForConnectivity = true
        return URLSession(configuration: cfg, delegate: self, delegateQueue: nil)
    }()

    private let stateQueue = DispatchQueue(label: "isitsafe.chat.ws")
    private var shouldRun = false          // 期望保持连接（disconnect() 置 false）
    private var reconnectAttempt = 0
    private var isConnected = false
    private var pingTimer: DispatchSourceTimer?

    private let decoder = JSONDecoder()

    private let pingInterval: TimeInterval = 25
    private let maxBackoff: TimeInterval = 8

    public override init() { super.init() }

    // MARK: - 生命周期

    /// 开始保持连接（幂等）。无登录态则不连。
    public func connect() {
        stateQueue.async { [weak self] in
            guard let self else { return }
            self.shouldRun = true
            if self.task == nil { self.openConnection() }
        }
    }

    /// 主动断开（登出/进后台可调）
    public func disconnect() {
        stateQueue.async { [weak self] in
            guard let self else { return }
            self.shouldRun = false
            self.teardown()
        }
    }

    // MARK: - 内部

    private func openConnection() {
        guard shouldRun else { return }
        guard let token = AuthInterceptor.token(), !token.isEmpty else {
            // 未登录：稍后由 connect() 再次触发；这里不重试
            return
        }
        guard let url = Self.wsURL(token: token) else { return }

        let t = session.webSocketTask(with: url)
        task = t
        t.resume()
        // 把当前 task 传给收包/心跳闭包：断开处理按 task 身份去重，
        // 避免 receive 失败与 didCloseWith 各触发一次 handleDrop（退避直接跳到 8s）
        receiveNext(on: t)
        schedulePing(for: t)
    }

    private func teardown() {
        pingTimer?.cancel(); pingTimer = nil
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
        setConnected(false)
    }

    private func receiveNext(on t: URLSessionWebSocketTask) {
        t.receive { [weak self] result in
            guard let self else { return }
            switch result {
            case .success(let message):
                self.setConnected(true)
                self.stateQueue.async { self.reconnectAttempt = 0 }
                switch message {
                case .string(let text): self.handleText(text)
                case .data(let data): self.handleData(data)
                @unknown default: break
                }
                self.receiveNext(on: t)   // 继续收下一条
            case .failure:
                self.stateQueue.async { self.handleDrop(for: t) }
            }
        }
    }

    private func handleText(_ text: String) {
        guard let data = text.data(using: .utf8) else { return }
        handleData(data)
    }

    private func handleData(_ data: Data) {
        guard let signal = try? decoder.decode(ChatSignal.self, from: data) else { return }
        // ready/error 只影响连接态，其余转交协调器
        if case .error(let reason) = signal {
            // 2026-09-07 复核：服务端在拒绝握手时会先发 {op:error} 再 close(4401/4403)。
            // 这类拒绝重连多少次都不会成功（token 失效 / 账号被禁用或删除），
            // 继续退避重连只是徒劳地打服务端，所以直接停掉本次会话，
            // 等下一次显式 connect()（换 token 后重新登录）再起。
            if Self.fatalRejectReasons.contains(reason) {
                stateQueue.async { [weak self] in
                    guard let self else { return }
                    self.shouldRun = false
                    self.pingTimer?.cancel(); self.pingTimer = nil
                    self.task?.cancel(with: .normalClosure, reason: nil)
                    self.task = nil
                }
            }
            return
        }
        if case .ready = signal { return }
        onSignal?(signal)
    }

    /// 服务端明确拒绝、重连无意义的原因（对应 close code 4401 / 4403）
    private static let fatalRejectReasons: Set<String> = ["unauthorized", "account_unavailable"]

    /// 连接掉了 → 若仍期望运行则退避重连。
    /// 2026-09-07 复核：同一次断开会被 receive 失败、didCloseWith、ping 失败重复上报，
    /// 以 task 身份去重——只有当前活跃 task 的断开才算数，重复上报直接忽略。
    private func handleDrop(for droppedTask: URLSessionWebSocketTask?) {
        guard let current = task, droppedTask === current else { return }
        pingTimer?.cancel(); pingTimer = nil
        task = nil
        setConnected(false)
        guard shouldRun else { return }
        reconnectAttempt += 1
        let backoff = min(maxBackoff, pow(2.0, Double(min(reconnectAttempt, 3))))  // 2,4,8,8...
        stateQueue.asyncAfter(deadline: .now() + backoff) { [weak self] in
            guard let self, self.shouldRun, self.task == nil else { return }
            self.openConnection()
        }
    }

    private func schedulePing(for t: URLSessionWebSocketTask) {
        pingTimer?.cancel()
        let timer = DispatchSource.makeTimerSource(queue: stateQueue)
        timer.schedule(deadline: .now() + pingInterval, repeating: pingInterval)
        timer.setEventHandler { [weak self, weak t] in
            guard let self, let t else { return }
            t.sendPing { [weak self] error in
                if error != nil { self?.stateQueue.async { self?.handleDrop(for: t) } }
            }
        }
        timer.resume()
        pingTimer = timer
    }

    private func setConnected(_ connected: Bool) {
        stateQueue.async { [weak self] in
            guard let self, self.isConnected != connected else { return }
            self.isConnected = connected
            DispatchQueue.main.async { self.onConnectedChange?(connected) }
        }
    }

    /// baseURL(http/https) → ws/wss + /chat?token=
    static func wsURL(token: String) -> URL? {
        let base = AppConfiguration.shared.baseURL
        guard var comps = URLComponents(string: base) else { return nil }
        switch comps.scheme {
        case "https": comps.scheme = "wss"
        case "http": comps.scheme = "ws"
        default: comps.scheme = "wss"
        }
        comps.path = "/chat"
        comps.queryItems = [URLQueryItem(name: "token", value: token)]
        return comps.url
    }
}

extension ChatWebSocketClient: URLSessionWebSocketDelegate {
    public func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask,
                           didOpenWithProtocol protocol: String?) {
        setConnected(true)
    }
    public func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask,
                           didCloseWith closeCode: URLSessionWebSocketTask.CloseCode, reason: Data?) {
        stateQueue.async { [weak self] in self?.handleDrop(for: webSocketTask) }
    }
}
