//
//  AuthRepository.swift
//  IsItSafe
//

import Foundation

public final class AuthRepository {
    public static let shared = AuthRepository()
    private let network = NetworkManager.shared

    private init() {}

    public func health() async throws -> HealthResponse {
        try await network.request(endpoint: .health)
    }

    public func login(_ request: LoginRequest) async throws -> LoginResponse {
        try await network.request(endpoint: .authLogin, body: request)
    }

    public func logout() async throws -> LogoutResponse {
        try await network.request(endpoint: .authLogout)
    }

    public func userInfo() async throws -> UserInfoResponse {
        try await network.request(endpoint: .authUserInfo)
    }

    /// 上传头像，返回 CDN URL
    public func uploadAvatar(imageData: Data, filename: String = "avatar.jpg") async throws -> String {
        try await network.uploadAvatar(imageData: imageData, filename: filename)
    }

    /// 更新用户资料
    public func updateProfile(avatar: String? = nil, nickname: String? = nil, gender: String? = nil, birthday: String? = nil) async throws {
        struct Body: Encodable {
            let avatar: String?
            let nickname: String?
            let gender: String?
            let birthday: String?
        }
        try await network.requestVoid(endpoint: .updateProfile, body: Body(avatar: avatar, nickname: nickname, gender: gender, birthday: birthday))
    }

    public func refreshToken(refreshToken: String) async throws -> LoginResponse {
        struct Body: Encodable { let refreshToken: String }
        return try await network.request(endpoint: .authRefreshToken, body: Body(refreshToken: refreshToken))
    }
}

public struct HealthResponse: Codable {
    public let status: String
}
