//
//  NetworkManager.swift
//  IsItSafe
//
//  全部接口唯一请求入口；使用泛型解码；统一错误抛出。View/ViewModel/Service 禁止直接使用 URLSession。
//

import Foundation

public final class NetworkManager {
    public static let shared = NetworkManager()
    private let session: URLSession
    private let decoder: JSONDecoder

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = AppConfiguration.shared.apiTimeout
        session = URLSession(configuration: config)
        decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
    }

    public func request<T: Decodable>(
        endpoint: APIEndpoint,
        body: Encodable? = nil,
        retries: Int = 0
    ) async throws -> T {
        let token = AuthInterceptor.token()
        var req = try RequestBuilder.build(endpoint: endpoint, baseURL: AppConfiguration.shared.baseURL, body: body, authToken: token)
        if AppConfiguration.shared.enableLogging {
            logRequest(req, body: body)
        }
        var lastError: Error?
        for attempt in 0...retries {
            do {
                let (data, response) = try await session.data(for: req)
                try ResponseValidator.validate(data: data, response: response)
                let decoded = try decoder.decode(T.self, from: data)
                if AppConfiguration.shared.enableLogging {
                    logResponse(data, for: endpoint)
                }
                return decoded
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
}

private struct EmptyResponse: Decodable {}
