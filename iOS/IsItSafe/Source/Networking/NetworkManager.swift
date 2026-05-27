//
//  NetworkManager.swift
//  IsItSafe
//
//  全部接口唯一请求入口；使用泛型解码；统一错误抛出。View/ViewModel/Service 禁止直接使用 URLSession。
//

import Foundation
import CryptoKit

// MARK: - TLS 证书固定代理
// 使用服务器叶证书的 DER SHA256 指纹做固定（certificate pinning）。
// 获取服务器证书指纹（终端执行）：
//   openssl s_client -connect api.starlensai.com:443 2>/dev/null \
//     | openssl x509 -outform der \
//     | openssl dgst -sha256 -binary \
//     | base64
// 将输出的 Base64 字符串填入下方数组。Let's Encrypt 证书每 90 天续期，续期后需更新并发版。
// 留空则退回 iOS 系统信任链验证。
private final class TLSValidationDelegate: NSObject, URLSessionDelegate {
    static let pinnedHashes: Set<String> = [
        // 请用上方命令重新计算后替换此行：
        // "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX="
    ]

    func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        guard challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
              let serverTrust = challenge.protectionSpace.serverTrust else {
            completionHandler(.cancelAuthenticationChallenge, nil)
            return
        }

        // 先做系统信任链校验
        var error: CFError?
        let trusted = SecTrustEvaluateWithError(serverTrust, &error)
        guard trusted else {
            completionHandler(.cancelAuthenticationChallenge, nil)
            return
        }

        // 若配置了 pinnedHashes，额外做 SPKI 指纹校验
        if !Self.pinnedHashes.isEmpty {
            var matched = false
            let certs: [SecCertificate]
            if #available(iOS 15.0, *) {
                certs = (SecTrustCopyCertificateChain(serverTrust) as? [SecCertificate]) ?? []
            } else {
                certs = (0..<SecTrustGetCertificateCount(serverTrust)).compactMap {
                    SecTrustGetCertificateAtIndex(serverTrust, $0)
                }
            }
            for cert in certs {
                if let spkiHash = Self.spkiSHA256(cert), Self.pinnedHashes.contains(spkiHash) {
                    matched = true
                    break
                }
            }
            if !matched {
                completionHandler(.cancelAuthenticationChallenge, nil)
                return
            }
        }

        completionHandler(.useCredential, URLCredential(trust: serverTrust))
    }

    private static func spkiSHA256(_ certificate: SecCertificate) -> String? {
        guard let key = SecCertificateCopyKey(certificate),
              let keyData = SecKeyCopyExternalRepresentation(key, nil) as Data? else { return nil }
        let hash = SHA256.hash(data: keyData)
        return Data(hash).base64EncodedString()
    }
}

public final class NetworkManager {
    public static let shared = NetworkManager()
    private let session: URLSession
    private let decoder: JSONDecoder
    private let forcedNetworkPrintPrefix = "NETWORK"

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = AppConfiguration.shared.apiTimeout
        // V2 接口启用 ETag/304 协商缓存：URLSession 会自动带 If-None-Match，
        // 命中 304 时系统透明返回缓存 body（statusCode 仍为 200），调用方无感知。
        // 仅对 V2 详情类接口有显著收益；列表/会变化的接口因为带 Cache-Control: must-revalidate，每次仍会发起请求。
        let mem = 10 * 1024 * 1024   // 10MB 内存
        let disk = 50 * 1024 * 1024  // 50MB 磁盘
        config.urlCache = URLCache(memoryCapacity: mem, diskCapacity: disk, diskPath: "isitsafe-http-cache")
        config.requestCachePolicy = .useProtocolCachePolicy
        // 使用 TLSValidationDelegate 做证书校验（填入 pinnedHashes 后自动启用固定）
        session = URLSession(configuration: config, delegate: TLSValidationDelegate(), delegateQueue: nil)
        decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase

        // 强制打印一次当前 baseURL（方便确认不是 localhost）
        print("\(forcedNetworkPrintPrefix) BASE_URL:", AppConfiguration.shared.baseURL)
    }

    public func request<T: Decodable>(
        endpoint: APIEndpoint,
        body: Encodable? = nil,
        retries: Int = 0
    ) async throws -> T {
        // 已登录场景：access token 临近过期主动刷新，避免被动 401
        // 没 token / 没 exp 字段时 no-op（详见 AuthService.ensureFreshTokenIfNearExpiry）
        await AuthService.shared.ensureFreshTokenIfNearExpiry()
        let token = AuthInterceptor.token()
        let req = try RequestBuilder.build(endpoint: endpoint, baseURL: AppConfiguration.shared.baseURL, body: body, authToken: token)
        printRequest(req, endpoint: endpoint, body: body)
        if AppConfiguration.shared.enableLogging { logRequest(req, body: body) }
        var lastError: Error?
        for attempt in 0...retries {
            do {
                let (data, response) = try await session.data(for: req)
                printResponse(data: data, response: response, endpoint: endpoint)
                try ResponseValidator.validate(data: data, response: response)
                do {
                    let decoded = try decoder.decode(T.self, from: data)
                    if AppConfiguration.shared.enableLogging { logResponse(data, for: endpoint) }
                    return decoded
                } catch {
                    // 解码失败时把原始响应也打印出来，便于定位字段不匹配
                    printDecodeError(error, data: data, endpoint: endpoint)
                    throw error
                }
            } catch {
                lastError = error
                if attempt < retries, (error as? APIError)?.canRetry == true {
                    try? await Task.sleep(nanoseconds: 1_000_000_000)
                    continue
                }
                throw mapError(error, data: nil)
            }
        }
        throw mapError(lastError ?? APIError.unknown(nil), data: nil)
    }

    public func requestVoid(endpoint: APIEndpoint, body: Encodable? = nil) async throws {
        let _: EmptyResponse = try await request(endpoint: endpoint, body: body)
    }

    /// 上传头像：multipart/form-data，返回 CDN URL
    public func uploadAvatar(imageData: Data, filename: String = "avatar.jpg") async throws -> String {
        let endpoint = APIEndpoint.uploadAvatar
        let boundary = "Boundary-\(UUID().uuidString)"
        var urlString = AppConfiguration.shared.baseURL
        if urlString.hasSuffix("/") { urlString = String(urlString.dropLast()) }
        urlString += endpoint.path
        guard let url = URL(string: urlString) else { throw APIError.invalidURL }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.timeoutInterval = AppConfiguration.shared.apiTimeout
        req.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token = AuthInterceptor.token() {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        var body = Data()
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(filename)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: image/jpeg\r\n\r\n".data(using: .utf8)!)
        body.append(imageData)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
        req.httpBody = body
        let (data, response) = try await session.data(for: req)
        try ResponseValidator.validate(data: data, response: response)
        struct UploadResponse: Decodable { let url: String }
        let decoded = try decoder.decode(UploadResponse.self, from: data)
        return decoded.url
    }

    /// 上传文件（如截图）到 OSS，type 取 screenshot 等，返回 CDN URL
    public func uploadFile(type: String, imageData: Data, mimeType: String = "image/jpeg", filename: String = "screenshot.jpg") async throws -> String {
        let endpoint = APIEndpoint.uploadFile
        let boundary = "Boundary-\(UUID().uuidString)"
        var urlString = AppConfiguration.shared.baseURL
        if urlString.hasSuffix("/") { urlString = String(urlString.dropLast()) }
        urlString += endpoint.path
        guard let url = URL(string: urlString) else { throw APIError.invalidURL }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.timeoutInterval = AppConfiguration.shared.apiTimeout
        req.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token = AuthInterceptor.token() {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        var body = Data()
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"type\"\r\n\r\n".data(using: .utf8)!)
        body.append("\(type)\r\n".data(using: .utf8)!)
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(filename)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: \(mimeType)\r\n\r\n".data(using: .utf8)!)
        body.append(imageData)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
        req.httpBody = body
        let (data, response) = try await session.data(for: req)
        try ResponseValidator.validate(data: data, response: response)
        struct UploadResponse: Decodable { let url: String }
        let decoded = try decoder.decode(UploadResponse.self, from: data)
        return decoded.url
    }

    private func mapError(_ error: Error, data: Data?) -> APIError {
        if let api = error as? APIError { return api }
        if let urlError = error as? URLError {
            switch urlError.code {
            case .timedOut: return .timeout
            case .notConnectedToInternet, .networkConnectionLost: return .networkError(urlError)
            default: return .networkError(urlError)
            }
        }
        if error is DecodingError { return .decodingError(error) }
        return .unknown(error.localizedDescription)
    }

    private func logRequest(_ request: URLRequest, body: Encodable?) {
        #if DEBUG
        print("[API] \(request.httpMethod ?? "") \(request.url?.absoluteString ?? "")")
        if let b = body, let data = try? JSONEncoder().encode(AnyEncodable(b)), let str = String(data: data, encoding: .utf8) {
            print("[API] body: \(str.prefix(500))")
        }
        #endif
    }

    private func logResponse(_ data: Data?, for endpoint: APIEndpoint) {
        #if DEBUG
        if let d = data, let str = String(data: d, encoding: .utf8) {
            print("[API] response \(endpoint.path): \(str.prefix(300))...")
        }
        #endif
    }

    // MARK: - Network 日志
    // Debug：完整请求/响应；Release：只打 method + path + status，避免 token/用户内容外泄
    private func printRequest(_ request: URLRequest, endpoint: APIEndpoint, body: Encodable?) {
        let method = request.httpMethod ?? endpoint.method.rawValue
        #if DEBUG
        let url = request.url?.absoluteString ?? ""
        print("\(forcedNetworkPrintPrefix) REQUEST:", method, url)

        if let headers = request.allHTTPHeaderFields, !headers.isEmpty {
            var safeHeaders = headers
            if let auth = safeHeaders["Authorization"], !auth.isEmpty {
                safeHeaders["Authorization"] = "Bearer <redacted>"
            }
            print("\(forcedNetworkPrintPrefix) REQUEST_HEADERS:", safeHeaders)
        }

        if let b = body, let data = try? JSONEncoder().encode(AnyEncodable(b)), let str = String(data: data, encoding: .utf8) {
            print("\(forcedNetworkPrintPrefix) REQUEST_BODY:", str)
        } else if let raw = request.httpBody, !raw.isEmpty, let str = String(data: raw, encoding: .utf8) {
            print("\(forcedNetworkPrintPrefix) REQUEST_BODY_RAW:", str)
        }
        #else
        // Release 仅输出方法 + 路径，不含 query / body / token
        print("\(forcedNetworkPrintPrefix) REQUEST:", method, endpoint.path)
        #endif
    }

    private func printResponse(data: Data?, response: URLResponse?, endpoint: APIEndpoint) {
        let status: String = (response as? HTTPURLResponse).map { "\($0.statusCode)" } ?? "unknown"
        #if DEBUG
        print("\(forcedNetworkPrintPrefix) RESPONSE:", endpoint.path, "status=\(status)")
        if let data = data {
            if let str = String(data: data, encoding: .utf8) {
                print("\(forcedNetworkPrintPrefix) RESPONSE_BODY:", str)
            } else {
                print("\(forcedNetworkPrintPrefix) RESPONSE_BODY:", "<non-utf8 \(data.count) bytes>")
            }
        } else {
            print("\(forcedNetworkPrintPrefix) RESPONSE_BODY:", "<empty>")
        }
        #else
        // Release 只记录状态码、内容大小，不打 body
        let size = data?.count ?? 0
        print("\(forcedNetworkPrintPrefix) RESPONSE:", endpoint.path, "status=\(status) size=\(size)")
        #endif
    }

    private func printDecodeError(_ error: Error, data: Data?, endpoint: APIEndpoint) {
        // 解码失败一律记录到日志（无论 Debug/Release），但 Release 下不打原始响应体
        print("\(forcedNetworkPrintPrefix) DECODE_ERROR:", endpoint.path, error.localizedDescription)
        #if DEBUG
        if let error = error as? DecodingError {
            print("\(forcedNetworkPrintPrefix) DECODE_ERROR_DETAIL:", String(describing: error))
        }
        if let data = data, let str = String(data: data, encoding: .utf8) {
            print("\(forcedNetworkPrintPrefix) DECODE_ERROR_RAW_BODY:", str)
        }
        #endif
    }
}

private struct EmptyResponse: Decodable {}
