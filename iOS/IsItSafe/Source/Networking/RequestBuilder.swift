//
//  RequestBuilder.swift
//  IsItSafe
//
//  构造 URLRequest：拼 baseURL、path、query、body、headers。
//

import Foundation

public final class RequestBuilder {
    public static func build(
        endpoint: APIEndpoint,
        baseURL: String,
        body: Encodable? = nil,
        authToken: String? = nil
    ) throws -> URLRequest {
        var urlString = baseURL.hasSuffix("/") ? String(baseURL.dropLast()) : baseURL
        urlString += endpoint.path

        var components = URLComponents(string: urlString)
        if let query = endpoint.queryItems, !query.isEmpty {
            components?.queryItems = query
        }
        guard let url = components?.url else { throw APIError.invalidURL }

        var request = URLRequest(url: url)
        request.httpMethod = endpoint.method.rawValue
        request.timeoutInterval = AppConfiguration.shared.apiTimeout
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        // 统一传递 App 语言给服务端，用于返回对应语言内容
        let lang = AppSettingsStore.shared.languageCode == "en" ? "en" : "zh"
        request.setValue(lang, forHTTPHeaderField: "X-App-Language")
        // V5.1：带上 App 版本，供服务端对新行为（家庭 IM 自动播报 / 免费 5 人）做版本门控。
        //       老版本不含此代码 → 不带此头 → 服务端按老逻辑处理，保证零影响。
        if let ver = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String {
            request.setValue(ver, forHTTPHeaderField: "X-App-Version")
        }

        if endpoint.requiresAuth, let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        } else if let token = authToken, !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body = body, endpoint.method != .GET {
            let encoder = JSONEncoder()
            request.httpBody = try encoder.encode(AnyEncodable(body))
        }
        return request
    }
}

/// 用于任意 Encodable 类型擦除，便于传入不同 body 类型
public struct AnyEncodable: Encodable {
    private let encode: (Encoder) throws -> Void
    public init<T: Encodable>(_ value: T) {
        encode = value.encode
    }
    public func encode(to encoder: Encoder) throws {
        try encode(encoder)
    }
}
