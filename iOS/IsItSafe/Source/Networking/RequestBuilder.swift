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
