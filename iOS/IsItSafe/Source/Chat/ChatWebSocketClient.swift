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
        receiveNext()
        schedulePing()
    }

    private func teardown() {
        pingTimer?.cancel(); pingTimer = nil
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
        setConnected(false)
    }

    private func receiveNext() {
        task?.receive { [weak self] result in
            guard let self else { return }
            switch result {
            case .success(let message):
                self.setConnected(true)
                self.reconnectAttempt = 0
                switch message {
                case .string(let text): self.handleText(text)
                case .data(let data): self.handleData(data)
                @unknown default: break
                }
                self.receiveNext()   // 继续收下一条
            case .failure:
                self.stateQueue.async { self.handleDrop() }
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
        if case .error = signal { return }
        if case .ready = signal { return }
        onSignal?(signal)
    }

    /// 连接掉了 → 若仍期望运行则退避重连
    private func handleDrop() {
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

    private func schedulePing() {
        pingTimer?.cancel()
        let timer = DispatchSource.makeTimerSource(queue: stateQueue)
        timer.schedule(deadline: .now() + pingInterval, repeating: pingInterval)
        timer.setEventHandler { [weak self] in
            guard let self, let task = self.task else { return }
            task.sendPing { [weak self] error in
                if error != nil { self?.stateQueue.async { self?.handleDrop() } }
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
        stateQueue.async { [weak self] in self?.handleDrop() }
    }
}
